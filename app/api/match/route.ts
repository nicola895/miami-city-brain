// POST /api/match — Step 2 (deterministic, no LLM): profile -> ranked candidate opportunities,
// plus O*NET target options / ladder skeleton in reskill mode.
import { NextResponse } from "next/server";
import { retrieveCandidates } from "@/lib/pipeline/retrieve";
import type { Mode, Profile } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { profile, mode, targetCode } = (await req.json()) as { profile: Profile; mode: Mode; targetCode?: string };
    return NextResponse.json(retrieveCandidates(profile, mode, { targetCode }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
