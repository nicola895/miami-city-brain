// The single place where Miami City Brain talks to Gemma 4 (via the Gemini API).
import { GoogleGenAI } from "@google/genai";
import { parseJsonTolerant } from "./json";

export const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
export const GEMMA_FALLBACK_MODEL = process.env.GEMMA_FALLBACK_MODEL || "gemma-4-31b-it";

const TIMEOUT_MS = 60_000;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env.local (see .env.example).");
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Gemma call timed out after ${ms / 1000}s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function callOnce(model: string, prompt: string, temperature: number): Promise<string> {
  const res = await withTimeout(
    getClient().models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature, maxOutputTokens: 8192 },
    }),
    TIMEOUT_MS,
  );
  const text = res.text ?? "";
  if (!text.trim()) throw new Error("Empty response from model");
  return text;
}

export interface GemmaResult {
  text: string;
  model: string;
  attempts: number;
  ms: number;
}

/** Calls Gemma 4: primary model, one retry, then the fallback model once. */
export async function gemmaText(prompt: string, temperature = 0.4): Promise<GemmaResult> {
  const start = Date.now();
  const plan = [GEMMA_MODEL, GEMMA_MODEL, GEMMA_FALLBACK_MODEL];
  let lastErr: unknown;
  for (let i = 0; i < plan.length; i++) {
    try {
      const text = await callOnce(plan[i], prompt, temperature);
      return { text, model: plan[i], attempts: i + 1, ms: Date.now() - start };
    } catch (e) {
      lastErr = e;
      console.warn(`[gemma] attempt ${i + 1} on ${plan[i]} failed:`, (e as Error).message);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Prompt-enforced JSON: asks Gemma 4 for JSON, parses tolerantly, and if parsing
 * or validation fails, asks once more with the error appended.
 */
export async function gemmaJson<T>(
  prompt: string,
  validate: (v: unknown) => T,
  temperature = 0.3,
): Promise<GemmaResult & { data: T }> {
  const suffix = "\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.";
  let res = await gemmaText(prompt + suffix, temperature);
  try {
    return { ...res, data: validate(parseJsonTolerant(res.text)) };
  } catch (e) {
    console.warn("[gemma] bad JSON, retrying:", (e as Error).message);
    const retryPrompt = `${prompt}${suffix}\n\nYour previous answer was invalid (${(e as Error).message}). Return corrected JSON only.`;
    res = await gemmaText(retryPrompt, 0.2);
    return { ...res, attempts: res.attempts + 1, data: validate(parseJsonTolerant(res.text)) };
  }
}
