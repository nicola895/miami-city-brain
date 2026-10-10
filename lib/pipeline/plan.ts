// Step 3 — Plan generation (Gemma 4). The model may only reference opportunity_ids from the
// candidate list; anything else is dropped server-side. Roles, codes and wages come from our data.
import { gemmaJson } from "../gemma";
import { renderPrompt } from "../prompts";
import { getOccupation } from "../data";
import type { Candidates, Lang, NewcomerPlan, Profile, ReskillPlan, ScoredOpportunity } from "../types";

const LANG_NAME: Record<Lang, string> = { en: "English", es: "Spanish (español neutro, natural for Miami)" };

function candidateLines(items: ScoredOpportunity[]): string {
  return items
    .map(({ opportunity: o, covers_gaps }) =>
      [
        `- id: ${o.id}`,
        `name: ${o.name}`,
        `type: ${o.type}`,
        `cost: ${o.cost}${o.cost_note ? ` (${o.cost_note})` : ""}`,
        o.duration && `duration: ${o.duration}`,
        o.schedule?.length && `schedule: ${o.schedule.join("/")}`,
        `languages: ${o.languages.join("/")}`,
        `no_degree: ${o.no_degree_friendly}`,
        o.neighborhood && `where: ${o.neighborhood}`,
        covers_gaps?.length && `covers: ${covers_gaps.join(", ")}`,
        `about: ${o.description.slice(0, 160)}`,
      ].filter(Boolean).join(" | "),
    )
    .join("\n");
}

function compactProfile(p: Profile): string {
  const { skills, skill_tags, ...rest } = p;
  return JSON.stringify({ ...rest, skills: skills.slice(0, 10), skill_tags });
}

const s = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface PlanResult<T> {
  plan: T;
  dropped_ids: string[];
  model: string;
  ms: number;
  attempts: number;
}

// ---------- Newcomer ----------

export async function generateNewcomerPlan(profile: Profile, cands: Candidates, lang: Lang): Promise<PlanResult<NewcomerPlan>> {
  const allowed = new Set(cands.items.map((i) => i.opportunity.id));
  const paths = (cands.target_options ?? [])
    .map((t) => `- ${t.onet_code}: ${lang === "es" ? t.title_es : t.title} (Miami median $${t.median_wage_miami ?? "n/a"})`)
    .join("\n");
  const prompt = renderPrompt("plan_newcomer", {
    profile: compactProfile(profile),
    candidates: candidateLines(cands.items),
    career_paths: paths || "(none)",
    language_name: LANG_NAME[lang],
  });
  const dropped: string[] = [];

  const validate = (v: unknown): NewcomerPlan => {
    const o = (v ?? {}) as Record<string, unknown>;
    const used = new Set<string>();
    const weeks = arr(o.weeks).slice(0, 4).map((w, i) => {
      const wk = (w ?? {}) as Record<string, unknown>;
      const items = arr(wk.items)
        .map((it) => (it ?? {}) as Record<string, unknown>)
        .filter((it) => {
          const id = s(it.opportunity_id);
          if (!allowed.has(id)) { if (id) dropped.push(id); return false; }
          if (used.has(id)) return false;
          used.add(id);
          return true;
        })
        .map((it) => ({ opportunity_id: s(it.opportunity_id), why_it_fits: s(it.why_it_fits), next_step: s(it.next_step) }));
      return { week: i + 1, focus: s(wk.focus, 80), items };
    });
    if (weeks.reduce((n, w) => n + w.items.length, 0) < 3) throw new Error("plan has fewer than 3 valid opportunities");
    const validCodes = new Set((cands.target_options ?? []).map((t) => t.onet_code));
    return {
      summary: s(o.summary, 600),
      weeks,
      career_paths: arr(o.career_paths)
        .map((c) => (c ?? {}) as Record<string, unknown>)
        .filter((c) => validCodes.has(s(c.onet_code)))
        .slice(0, 3)
        .map((c) => ({ title: s(c.title, 100), onet_code: s(c.onet_code), why: s(c.why) })),
      first_message_template: s(o.first_message_template, 800),
    };
  };

  const res = await gemmaJson(prompt, validate, 0.4);
  return { plan: res.data, dropped_ids: [...new Set(dropped)], model: res.model, ms: res.ms, attempts: res.attempts };
}

// ---------- Reskill ----------

export async function generateReskillPlan(profile: Profile, cands: Candidates, lang: Lang): Promise<PlanResult<ReskillPlan>> {
  if (!cands.ladder?.length) throw new Error("No ladder skeleton — pick a target role first.");
  const byId = new Map(cands.items.map((i) => [i.opportunity.id, i.opportunity]));
  const skeleton = cands.ladder.map((st) => ({
    step: st.step,
    title: lang === "es" ? st.title_es : st.title,
    onet_code: st.onet_code,
    median_wage_miami: st.median_wage_miami ?? "n/a",
    typical_education: st.typical_education,
    transferable_skills: st.transferable_skills,
    skills_to_build: st.skills_to_build,
    training_candidate_ids: st.training_candidate_ids,
  }));
  const prompt = renderPrompt("plan_reskill", {
    profile: compactProfile(profile),
    ladder: JSON.stringify(skeleton, null, 1),
    candidates: candidateLines(cands.items),
    budget: profile.constraints.budget,
    hours: profile.constraints.hours_per_week ?? "unknown",
    schedule: profile.constraints.schedule.join("/") || "flexible",
    degree: profile.has_us_degree ? "has a US degree" : "no US degree",
    language_name: LANG_NAME[lang],
  });
  const dropped: string[] = [];

  const validate = (v: unknown): ReskillPlan => {
    const o = (v ?? {}) as Record<string, unknown>;
    const modelSteps = arr(o.ladder).map((x) => (x ?? {}) as Record<string, unknown>);
    const ladder = cands.ladder!.map((st, i) => {
      const m = modelSteps.find((x) => Number(x.step) === st.step) ?? modelSteps[i] ?? {};
      const seen = new Set<string>();
      let options = arr(m.options)
        .map((op) => (op ?? {}) as Record<string, unknown>)
        .filter((op) => {
          const id = s(op.opportunity_id);
          if (!byId.has(id)) { if (id) dropped.push(id); return false; }
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .slice(0, 3)
        .map((op) => ({ opportunity_id: s(op.opportunity_id), why: s(op.why) }));
      // Grounding fallback: if the model gave nothing valid, use the matcher's top trainings.
      if (!options.length) options = st.training_candidate_ids.slice(0, 2).map((id) => ({ opportunity_id: id, why: "" }));
      return {
        step: st.step,
        role: s(m.role, 100) || (lang === "es" ? st.title_es : st.title),
        onet_code: st.onet_code,
        median_wage_miami: st.median_wage_miami,
        transferable_skills: st.transferable_skills,
        skills_to_build: st.skills_to_build,
        options: options.map((op) => {
          const opp = byId.get(op.opportunity_id)!;
          return { ...op, cost: opp.cost_note ?? opp.cost, duration: opp.duration, schedule: opp.schedule };
        }),
        est_time_to_reach: s(m.est_time_to_reach, 80),
        next_action_this_week: s(m.next_action_this_week),
      };
    });
    if (!s(modelSteps[0]?.next_action_this_week)) throw new Error("missing next_action_this_week for step 1");
    const network_items = arr(o.network_items)
      .map((n) => (n ?? {}) as Record<string, unknown>)
      .filter((n) => {
        const ok = byId.has(s(n.opportunity_id));
        if (!ok && s(n.opportunity_id)) dropped.push(s(n.opportunity_id));
        return ok;
      })
      .slice(0, 4)
      .map((n) => ({ opportunity_id: s(n.opportunity_id), why: s(n.why) }));
    const target = getOccupation(cands.target?.onet_code);
    return {
      summary: s(o.summary, 600),
      target_options: target
        ? [{ title: lang === "es" ? target.title_es : target.title, onet_code: target.onet_code, why_it_fits: "", median_wage_miami: target.median_wage_miami }]
        : [],
      ladder,
      network_items,
      first_message_template: s(o.first_message_template, 800),
    };
  };

  const res = await gemmaJson(prompt, validate, 0.4);
  return { plan: res.data, dropped_ids: [...new Set(dropped)], model: res.model, ms: res.ms, attempts: res.attempts };
}
