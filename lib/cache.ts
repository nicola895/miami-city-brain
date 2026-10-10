// Small on-disk cache so a demo profile you already ran comes back instantly (rehearse, then demo).
// Stores only model outputs keyed by a hash — never the raw CV text.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), ".cache");
const key = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);

export async function cached<T extends object>(parts: unknown[], enabled: boolean, fn: () => Promise<T>): Promise<T & { cached?: boolean }> {
  if (!enabled) return fn();
  const file = path.join(DIR, `${key(parts)}.json`);
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, "utf8")), cached: true };
  const value = await fn();
  mkdirSync(DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(value));
  return value as T & { cached?: boolean };
}
