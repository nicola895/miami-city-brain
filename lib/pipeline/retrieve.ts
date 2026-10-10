// Step 2 — Candidate retrieval (deterministic, no LLM).
// Scores opportunities by tag overlap and, in reskill mode, uses O*NET skills + BLS wages
// to compute transferable skills, skill gaps, target options and a career ladder.
import { loadOnet, loadOpportunities, getOccupation } from "../data";
import type {
  Candidates, LadderStepSkeleton, Mode, Occupation, Opportunity, Profile, ScoredOpportunity, TargetOption,
} from "../types";

const NETWORK_TYPES = new Set(["community", "meetup", "mentorship", "event", "career-service"]);
const TRAINING_TYPES = new Set(["training", "certificate", "apprenticeship", "program"]);
const EDU_RANK = { none: 0, high_school: 1, postsecondary_cert: 2, associate: 3, bachelor: 4 } as const;

interface Ctx {
  profile: Profile;
  mode: Mode;
  sectors: Set<string>;
  gaps: Set<string>;
  noDegree: boolean;
  spanishFirst: boolean;
}

/** Best-effort text match of a job title to our O*NET subset (fallback when the model gave no code). */
export function matchOccupation(role?: string | null): Occupation | undefined {
  if (!role) return undefined;
  const r = role.toLowerCase();
  const occs = loadOnet();
  return (
    occs.find((o) => o.aliases.some((a) => r.includes(a))) ??
    occs.find((o) => o.title.toLowerCase().includes(r)) ??
    occs
      .map((o) => ({ o, hits: r.split(/\W+/).filter((w) => w.length > 3 && o.title.toLowerCase().includes(w)).length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)[0]?.o
  );
}

export function scoreOpportunity(o: Opportunity, ctx: Ctx): ScoredOpportunity {
  const { profile, mode } = ctx;
  let score = 0;
  const reasons: string[] = [];

  const sectorHits = o.sector_tags.filter((s) => ctx.sectors.has(s));
  if (sectorHits.length) { score += 3 * sectorHits.length; reasons.push(`sector: ${sectorHits.join(", ")}`); }
  if (o.sector_tags.includes("general")) score += 0.5;

  const speaksEs = o.languages.includes("es") || o.audience_tags.includes("spanish_speaker");
  if (ctx.spanishFirst) {
    if (speaksEs) { score += 3; reasons.push("offered in Spanish"); } else score -= 2;
  }
  if (mode === "newcomer" && o.audience_tags.some((t) => t === "newcomer" || t === "immigrant")) {
    score += 2; reasons.push("for newcomers");
  }
  if (mode === "reskill" && o.audience_tags.includes("career_changer")) { score += 2; reasons.push("for career changers"); }
  if (ctx.noDegree && o.no_degree_friendly) { score += mode === "reskill" ? 2 : 1; reasons.push("no degree needed"); }
  if (profile.goals.includes("start_business") && o.audience_tags.some((t) => t === "founders" || t === "small_business")) {
    score += 2; reasons.push("for founders");
  }
  if (profile.goals.includes("meet_people") && NETWORK_TYPES.has(o.type)) score += 1;
  if (profile.goals.includes("learn_english") && o.skills_taught?.includes("english_language")) {
    score += 3; reasons.push("English classes");
  }

  const budget = profile.constraints.budget;
  if (budget === "free" || budget === "low") {
    if (o.cost === "free") { score += 2; reasons.push("free"); }
    else if (o.cost === "low") score += 1;
    else if (o.cost === "paid") score -= budget === "free" ? 3 : 1.5;
  }

  const want = profile.constraints.schedule;
  if (want.length && o.schedule?.length) {
    const fit = o.schedule.filter((s) => want.includes(s));
    if (fit.length) { score += fit.length; reasons.push(`schedule: ${fit.join("/")}`); }
    else if (o.schedule.every((s) => s === "full-time")) score -= 2;
  }

  let covers: string[] | undefined;
  if (ctx.gaps.size && o.skills_taught?.length) {
    covers = o.skills_taught.filter((s) => ctx.gaps.has(s));
    if (covers.length) { score += 4 * Math.min(3, covers.length); reasons.push(`teaches: ${covers.join(", ")}`); }
  }
  if (o.needs_verification) score -= 0.5;

  return { opportunity: o, score: Math.round(score * 10) / 10, reasons, covers_gaps: covers };
}

function makeCtx(profile: Profile, mode: Mode, sectors: string[], gaps: string[] = []): Ctx {
  return {
    profile, mode,
    sectors: new Set(sectors),
    gaps: new Set(gaps),
    noDegree: !profile.has_us_degree,
    spanishFirst: profile.preferred_language === "es",
  };
}

function topDiverse(items: ScoredOpportunity[], n: number, maxPerType: number): ScoredOpportunity[] {
  const count: Record<string, number> = {};
  const out: ScoredOpportunity[] = [];
  for (const it of [...items].sort((a, b) => b.score - a.score)) {
    const t = it.opportunity.type;
    if ((count[t] ?? 0) >= maxPerType) continue;
    count[t] = (count[t] ?? 0) + 1;
    out.push(it);
    if (out.length >= n) break;
  }
  return out;
}

export function userSkillSet(profile: Profile, current?: Occupation | null): Set<string> {
  return new Set([...profile.skill_tags, ...(current?.key_skills ?? [])]);
}

function resolveCurrent(profile: Profile): Occupation | null {
  return getOccupation(profile.current_onet_code) ?? matchOccupation(profile.current_role) ?? null;
}

// ---------- Newcomer mode ----------

function retrieveNewcomer(profile: Profile): Candidates {
  const current = resolveCurrent(profile);
  const sectors = [...profile.sectors, ...profile.target_sectors, ...(current ? [current.sector] : [])];
  if (profile.goals.includes("start_business")) sectors.push("startups");
  const ctx = makeCtx(profile, "newcomer", sectors);
  const scored = loadOpportunities()
    .filter((o) => o.modes.includes("newcomer"))
    .map((o) => scoreOpportunity(o, ctx));

  // Career paths: current occupation + its O*NET related occupations, with Miami wages.
  const paths = current
    ? [current, ...current.related_codes.map((c) => getOccupation(c)).filter((o): o is Occupation => !!o)]
    : [];
  const skills = userSkillSet(profile, current);
  const target_options: TargetOption[] = paths.slice(0, 5).map((o) => toTargetOption(o, skills));

  return { mode: "newcomer", items: topDiverse(scored, 18, 5), current, target_options };
}

// ---------- Reskill mode ----------

function toTargetOption(o: Occupation, skills: Set<string>): TargetOption {
  const transferable = o.key_skills.filter((s) => skills.has(s));
  return {
    onet_code: o.onet_code,
    title: o.title,
    title_es: o.title_es,
    median_wage_miami: o.median_wage_miami,
    skill_overlap: o.key_skills.length ? transferable.length / o.key_skills.length : 0,
    transferable_skills: transferable,
    skills_to_build: o.key_skills.filter((s) => !skills.has(s)),
  };
}

/** Graph distance in the O*NET related-occupations network (undirected), capped. */
function graphDistance(from: string, to: string, max = 3): number {
  const occs = loadOnet();
  const nbrs = (code: string) => {
    const o = occs.find((x) => x.onet_code === code);
    return new Set([...(o?.related_codes ?? []), ...occs.filter((x) => x.related_codes.includes(code)).map((x) => x.onet_code)]);
  };
  let frontier = new Set([from]);
  const seen = new Set([from]);
  for (let d = 1; d <= max; d++) {
    const next = new Set<string>();
    for (const c of frontier) for (const n of nbrs(c)) if (!seen.has(n)) { seen.add(n); next.add(n); }
    if (next.has(to)) return d;
    frontier = next;
  }
  return max + 1;
}

/** Suggest 3 target roles: better-paid, high skill overlap, realistic for their education, diverse sectors. */
export function suggestTargets(profile: Profile, current: Occupation | null, targetSectors: string[]): TargetOption[] {
  const skills = userSkillSet(profile, current);
  const base = profile.current_pay_annual ?? current?.median_wage_miami ?? 40_000;
  const noDegree = !profile.has_us_degree;
  const ranked = loadOnet()
    .filter((o) => o.onet_code !== current?.onet_code && (o.median_wage_miami ?? 0) >= base * 1.25)
    .filter((o) => !targetSectors.length || targetSectors.includes(o.sector) || o.sector === "general")
    .map((o) => {
      const opt = toTargetOption(o, skills);
      if (!opt.skills_to_build.length) return null; // reskilling means learning something new
      const uplift = Math.min(0.3, ((o.median_wage_miami ?? base) / base - 1) * 0.3);
      const sectorBonus = targetSectors.includes(o.sector) ? 0.25 : 0;
      const eduPenalty = noDegree && o.typical_education === "bachelor" ? 0.6 : 1;
      const near = current ? Math.max(0, 0.15 - 0.05 * graphDistance(current.onet_code, o.onet_code)) : 0;
      return { opt, o, score: (opt.skill_overlap + uplift + sectorBonus + near) * eduPenalty };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score);

  // One per sector first, then fill.
  const out: typeof ranked = [];
  const usedSectors = new Set<string>();
  for (const r of ranked) if (!usedSectors.has(r.o.sector) && out.length < 3) { out.push(r); usedSectors.add(r.o.sector); }
  for (const r of ranked) if (out.length < 3 && !out.includes(r)) out.push(r);
  return out.map((r) => r.opt);
}

/** Build Now -> bridge -> target (-> next) as O*NET occupations. */
export function buildLadderRoles(profile: Profile, current: Occupation | null, target: Occupation): Occupation[] {
  const skills = userSkillSet(profile, current);
  const base = profile.current_pay_annual ?? current?.median_wage_miami ?? 0;
  const targetWage = target.median_wage_miami ?? Infinity;
  const isRelated = (a: Occupation, b: Occupation) => a.related_codes.includes(b.onet_code) || b.related_codes.includes(a.onet_code);
  const overlap = (o: Occupation) => o.key_skills.filter((s) => skills.has(s)).length / Math.max(1, o.key_skills.length);

  const bridge = loadOnet()
    .filter((o) => o.onet_code !== target.onet_code && o.onet_code !== current?.onet_code)
    .filter((o) => isRelated(o, target) && (o.median_wage_miami ?? 0) > base && (o.median_wage_miami ?? 0) < targetWage)
    .filter((o) => EDU_RANK[o.typical_education] <= EDU_RANK.associate)
    .sort((a, b) => overlap(b) - overlap(a))[0];

  const roles = bridge ? [bridge, target] : [target];
  if (roles.length < 3) {
    // A growth step after the target, so entry-level targets still show a ladder.
    const next = target.related_codes
      .map((c) => getOccupation(c))
      .filter((o): o is Occupation => !!o && (o.median_wage_miami ?? 0) > targetWage && o.onet_code !== current?.onet_code)
      .sort((a, b) => {
        const ta = a.key_skills.filter((s) => target.key_skills.includes(s)).length;
        const tb = b.key_skills.filter((s) => target.key_skills.includes(s)).length;
        return tb - ta || (a.median_wage_miami ?? 0) - (b.median_wage_miami ?? 0);
      })[0];
    if (next) roles.push(next);
  }
  return roles.slice(0, 3);
}

function retrieveReskill(profile: Profile, targetCode?: string | null, targetSectors: string[] = []): Candidates {
  const current = resolveCurrent(profile);
  const target =
    getOccupation(targetCode) ?? getOccupation(profile.target_onet_code) ?? matchOccupation(profile.target_role) ?? null;
  const sectorsFromGoals = targetSectors.length ? targetSectors : profile.target_sectors;

  if (!target) {
    // Not sure where to go: offer 3 target options and let the user pick.
    return { mode: "reskill", items: [], current, target: null, target_options: suggestTargets(profile, current, sectorsFromGoals) };
  }

  const opps = loadOpportunities().filter((o) => o.modes.includes("reskill"));
  const known = userSkillSet(profile, current);
  const ladder: LadderStepSkeleton[] = [];
  const items = new Map<string, ScoredOpportunity>();

  buildLadderRoles(profile, current, target).forEach((role, i) => {
    const transferable = role.key_skills.filter((s) => known.has(s));
    const toBuild = role.key_skills.filter((s) => !known.has(s));
    const ctx = makeCtx(profile, "reskill", [role.sector], toBuild);
    const trainings = opps
      .filter((o) => TRAINING_TYPES.has(o.type) || o.type === "career-service")
      .map((o) => scoreOpportunity(o, ctx))
      .filter((s) => (s.covers_gaps?.length ?? 0) > 0 || s.opportunity.type === "career-service")
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    trainings.forEach((t) => items.set(t.opportunity.id, t));
    ladder.push({
      step: i + 1,
      onet_code: role.onet_code,
      title: role.title,
      title_es: role.title_es,
      median_wage_miami: role.median_wage_miami,
      typical_education: role.typical_education,
      transferable_skills: transferable,
      skills_to_build: toBuild,
      training_candidate_ids: trainings.map((t) => t.opportunity.id),
    });
    toBuild.forEach((s) => known.add(s)); // learned by the time they reach the next step
  });

  // Network in the target field.
  const netCtx = makeCtx(profile, "reskill", [target.sector, ...sectorsFromGoals]);
  loadOpportunities()
    .filter((o) => NETWORK_TYPES.has(o.type))
    .map((o) => scoreOpportunity(o, netCtx))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .forEach((s) => items.set(s.opportunity.id, s));

  return {
    mode: "reskill",
    items: [...items.values()].sort((a, b) => b.score - a.score).slice(0, 20),
    current,
    target,
    ladder,
  };
}

export function retrieveCandidates(
  profile: Profile, mode: Mode, opts: { targetCode?: string | null; targetSectors?: string[] } = {},
): Candidates {
  return mode === "newcomer" ? retrieveNewcomer(profile) : retrieveReskill(profile, opts.targetCode, opts.targetSectors);
}
