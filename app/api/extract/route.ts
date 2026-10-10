// POST /api/extract — Step 1 (Gemma 4): CV (PDF or text) + form answers -> structured profile.
// The CV is processed in memory only and never stored.
import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { extractProfile, type FormHints } from "@/lib/pipeline/extract";
import { cached } from "@/lib/cache";
import type { Lang, Mode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const mode = (form.get("mode") === "reskill" ? "reskill" : "newcomer") as Mode;
    const lang = (form.get("lang") === "es" ? "es" : "en") as Lang;
    const personaId = String(form.get("persona") || "");
    const hints: FormHints = JSON.parse(String(form.get("hints") || "{}"));
    let text = String(form.get("text") || "");

    const file = form.get("file");
    if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "PDF too large (max 5 MB)" }, { status: 400 });
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text: pdfText } = await extractText(pdf, { mergePages: true });
      text = `${pdfText}\n${text}`;
    }
    if (text.trim().length < 20 && !hints.current_role) {
      return NextResponse.json({ error: "Please paste a short description, upload a CV, or fill in the form." }, { status: 400 });
    }

    // Only demo personas are cached (they contain no real personal data).
    const result = await cached(["extract", personaId, mode, lang, hints], !!personaId, () =>
      extractProfile(text, mode, lang, hints),
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[extract]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
