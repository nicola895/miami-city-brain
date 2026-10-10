// Deterministic matcher CLI for the Miami City Brain Agent Skill (no LLM, no API key needed).
// Usage (from the repo root):
//   npx tsx skills/miami-city-brain/scripts/match.ts --mode reskill --profile profile.json [--target 15-1232.00]
//   npx tsx skills/miami-city-brain/scripts/match.ts --mode newcomer --profile -   (reads profile JSON from stdin)
import { readFileSync } from "node:fs";
import { retrieveCandidates } from "../../../lib/pipeline/retrieve";
import type { Mode, Profile } from "../../../lib/types";

const args = process.argv.slice(2);
const get = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const mode = (get("mode") === "reskill" ? "reskill" : "newcomer") as Mode;
const src = get("profile") ?? "-";
const raw = src === "-" ? readFileSync(0, "utf8") : readFileSync(src, "utf8");

const defaults: Profile = {
  current_role: "", years_experience: null, skills: [], skill_tags: [], sectors: [], target_sectors: [],
  education_level: "unknown", has_us_degree: false, languages: ["en"], goals: [],
  constraints: { budget: "any", hours_per_week: null, schedule: [], transport: null, family: null },
  preferred_language: "en", lives_in_miami: mode === "reskill",
};
const input = JSON.parse(raw);
const profile: Profile = { ...defaults, ...input, constraints: { ...defaults.constraints, ...(input.constraints ?? {}) } };

const c = retrieveCandidates(profile, mode, { targetCode: get("target") });
const out = {
  mode,
  current: c.current && { onet_code: c.current.onet_code, title: c.current.title, median_wage_miami: c.current.median_wage_miami },
  target: c.target && { onet_code: c.target.onet_code, title: c.target.title, median_wage_miami: c.target.median_wage_miami },
  target_options: c.target_options,
  ladder: c.ladder,
  candidates: c.items.map(({ opportunity: o, score, reasons, covers_gaps }) => ({
    opportunity_id: o.id, name: o.name, type: o.type, url: o.url, cost: o.cost, cost_note: o.cost_note,
    duration: o.duration, schedule: o.schedule, languages: o.languages, no_degree_friendly: o.no_degree_friendly,
    needs_verification: o.needs_verification, score, reasons, covers_gaps,
  })),
};
console.log(JSON.stringify(out, null, 2));
