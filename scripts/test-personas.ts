// Runs every demo persona through the full pipeline: extract -> retrieve -> plan.
// Run: npm run test:personas   (optionally: npm run test:personas -- reskill-hotel-supervisor)
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extractProfile } from "../lib/pipeline/extract";
import { retrieveCandidates } from "../lib/pipeline/retrieve";
import { generateNewcomerPlan, generateReskillPlan } from "../lib/pipeline/plan";
import type { Lang, Mode } from "../lib/types";

interface Persona { id: string; mode: Mode; preferred_language: Lang; text: string }

async function run(p: Persona) {
  console.log(`\n=== ${p.id} (${p.mode}, ${p.preferred_language}) ===`);
  const ex = await extractProfile(p.text, p.mode, p.preferred_language);
  const prof = ex.profile;
  console.log(`1) profile [${ex.model}, ${ex.ms}ms]: ${prof.current_role} (${prof.current_onet_code}) | skills=${prof.skill_tags.join(",")} | sectors=${prof.sectors} -> ${prof.target_sectors} | degree=${prof.has_us_degree} | lang=${prof.preferred_language}`);

  let cands = retrieveCandidates(prof, p.mode);
  if (p.mode === "reskill" && !cands.target) {
    console.log("2a) target options:");
    for (const t of cands.target_options ?? [])
      console.log(`    - ${t.title} (${t.onet_code}) $${t.median_wage_miami} overlap=${t.skill_overlap.toFixed(2)} build=${t.skills_to_build.join(",")}`);
    const pick = cands.target_options?.[0];
    if (!pick) throw new Error("no target options");
    cands = retrieveCandidates(prof, p.mode, { targetCode: pick.onet_code });
  }
  console.log(`2) ${cands.items.length} candidates: ${cands.items.slice(0, 8).map((i) => `${i.opportunity.id}(${i.score})`).join(", ")}`);
  if (cands.ladder) for (const st of cands.ladder)
    console.log(`    step ${st.step}: ${st.title} $${st.median_wage_miami} | have=${st.transferable_skills.join(",")} | build=${st.skills_to_build.join(",")} | trainings=${st.training_candidate_ids.join(",")}`);

  const res = p.mode === "newcomer"
    ? await generateNewcomerPlan(prof, cands, p.preferred_language)
    : await generateReskillPlan(prof, cands, p.preferred_language);
  console.log(`3) plan [${res.model}, ${res.ms}ms, attempts=${res.attempts}] dropped_ids=${JSON.stringify(res.dropped_ids)}`);
  console.log(`   summary: ${res.plan.summary}`);
  mkdirSync("scripts/out", { recursive: true });
  writeFileSync(`scripts/out/${p.id}.json`, JSON.stringify({ profile: prof, candidates: cands, plan: res.plan }, null, 2));
}

async function main() {
  const only = process.argv[2];
  const files = readdirSync("data/demo_personas").filter((f) => f.endsWith(".json"));
  const personas: Persona[] = files.map((f) => JSON.parse(readFileSync(`data/demo_personas/${f}`, "utf8")));
  let failed = 0;
  for (const p of personas.filter((x) => !only || x.id === only)) {
    try { await run(p); } catch (e) { failed++; console.error(`FAILED ${p.id}:`, (e as Error).message); }
  }
  process.exit(failed ? 1 : 0);
}
main();
