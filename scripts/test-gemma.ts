// Smoke test: one Gemma 4 call through the same wrapper the app uses.
import { gemmaJson, GEMMA_MODEL } from "../lib/gemma";

async function main() {
  console.log(`Calling ${GEMMA_MODEL} via the Gemini API...`);
  const res = await gemmaJson(
    'Give me 3 Miami neighborhoods popular with tech newcomers as JSON: {"neighborhoods": [{"name": string, "why": string}]}',
    (v) => {
      const o = v as { neighborhoods?: unknown[] };
      if (!Array.isArray(o.neighborhoods)) throw new Error("missing neighborhoods[]");
      return o as { neighborhoods: { name: string; why: string }[] };
    },
  );
  console.log(`OK: model=${res.model} attempts=${res.attempts} time=${res.ms}ms`);
  console.log(JSON.stringify(res.data, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
