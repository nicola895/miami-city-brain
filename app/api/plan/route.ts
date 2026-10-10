// POST /api/plan — Step 3 (Gemma 4): profile + candidates -> grounded plan.
// Candidates are recomputed server-side so the model only ever sees our curated data.
import { NextResponse } from "next/server";
import { retrieveCandidates } from "@/lib/pipeline/retrieve";
import { generateNewcomerPlan, generateReskillPlan } from "@/lib/pipeline/plan";
import { cached } from "@/lib/cache";
import type { Lang, Mode, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { profile, mode, lang, targetCode, personaId } = (await req.json()) as {
      profile: Profile; mode: Mode; lang: Lang; targetCode?: string; personaId?: string;
    };
    const candidates = retrieveCandidates(profile, mode, { targetCode });
    const run = (): Promise<object> =>
      mode === "newcomer" ? generateNewcomerPlan(profile, candidates, lang) : generateReskillPlan(profile, candidates, lang);
    const result = await cached(["plan", personaId, mode, lang, targetCode, profile], !!personaId, run);
    const opportunities = Object.fromEntries(candidates.items.map((i) => [i.opportunity.id, i.opportunity]));
    return NextResponse.json({ ...result, candidates, opportunities });
  } catch (e) {
    console.error("[plan]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
