// Step 1 — Profile extraction (Gemma 4): CV / form text -> structured profile JSON.
import { gemmaJson } from "../gemma";
import { loadOnet, getOccupation } from "../data";
import { renderPrompt } from "../prompts";
import { SKILLS, SECTORS, GOALS, isSkill, isSector } from "../vocab";
import type { Lang, Mode, Profile } from "../types";

export interface FormHints {
  current_role?: string;
  skills?: string[];
  goals?: string[];
  target_role?: string;
  budget?: string;
  hours_per_week?: number;
  schedule?: string[];
  neighborhood?: string;
  no_degree?: boolean;
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

function validateProfile(v: unknown, lang: Lang): Profile {
  if (!v || typeof v !== "object") throw new Error("profile is not an object");
  const o = v as Record<string, unknown>;
  if (!str(o.current_role) && !arr(o.skills).length) throw new Error("profile missing current_role and skills");
  const c = (o.constraints ?? {}) as Record<string, unknown>;
  const code = (k: string) => (getOccupation(str(o[k])) ? str(o[k]) : null);
  return {
    current_role: str(o.current_role) ?? "",
    current_onet_code: code("current_onet_code"),
    years_experience: num(o.years_experience),
    current_pay_annual: num(o.current_pay_annual),
    skills: arr(o.skills).slice(0, 15),
    skill_tags: arr(o.skill_tags).filter(isSkill),
    sectors: arr(o.sectors).filter(isSector),
    target_sectors: arr(o.target_sectors).filter(isSector),
    education_level: str(o.education_level) ?? "unknown",
    has_us_degree: o.has_us_degree === true,
    languages: arr(o.languages).map((l) => l.toLowerCase().slice(0, 2)),
    goals: arr(o.goals),
    target_role: str(o.target_role),
    target_onet_code: code("target_onet_code"),
    constraints: {
      budget: (["free", "low", "any"].includes(String(c.budget)) ? c.budget : "any") as Profile["constraints"]["budget"],
      hours_per_week: num(c.hours_per_week),
      schedule: arr(c.schedule),
      transport: str(c.transport),
      family: str(c.family),
    },
    neighborhood: str(o.neighborhood),
    preferred_language: o.preferred_language === "es" ? "es" : o.preferred_language === "en" ? "en" : lang,
    lives_in_miami: o.lives_in_miami === true,
  };
}

function hintsBlock(h?: FormHints): string {
  if (!h) return "";
  const lines = Object.entries(h)
    .filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  return lines.length ? `FORM ANSWERS (the user filled these in; they override the CV):\n${lines.join("\n")}\n` : "";
}

export async function extractProfile(text: string, mode: Mode, lang: Lang, hints?: FormHints) {
  const occupations = loadOnet()
    .map((o) => `${o.onet_code}: ${o.title}${o.aliases.length ? ` [${o.aliases.join(", ")}]` : ""}`)
    .join("\n");
  const prompt = renderPrompt("extract_profile", {
    mode,
    lang,
    text: text.slice(0, 12_000),
    skill_tags: SKILLS.join(", "),
    sector_tags: SECTORS.join(", "),
    goal_tags: GOALS.join(", "),
    occupations,
    form_hints: hintsBlock(hints),
  });
  const res = await gemmaJson(prompt, (v) => validateProfile(v, lang), 0.1);
  const profile = res.data;
  // Form answers win over model guesses.
  if (hints?.no_degree) profile.has_us_degree = false;
  if (hints?.budget) profile.constraints.budget = hints.budget as Profile["constraints"]["budget"];
  if (hints?.hours_per_week) profile.constraints.hours_per_week = hints.hours_per_week;
  if (hints?.schedule?.length) profile.constraints.schedule = hints.schedule;
  profile.lives_in_miami = mode === "reskill" ? true : profile.lives_in_miami;
  profile.preferred_language = lang; // the EN/ES toggle decides the plan language

  return { profile, model: res.model, ms: res.ms, attempts: res.attempts };
}
