// Loads the versioned data files in /data (shared by the web app and the Agent Skill).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Occupation, Opportunity } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

/** Minimal CSV parser (handles quoted fields with commas). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const split = (s: string) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);

let onetCache: Occupation[] | null = null;
export function loadOnet(): Occupation[] {
  if (onetCache) return onetCache;
  const rows = parseCsv(readFileSync(path.join(DATA_DIR, "onet_subset.csv"), "utf8"));
  const wages = loadWages();
  onetCache = rows.map((r) => {
    const w = wages.get(r.onet_code.slice(0, 7));
    return {
      onet_code: r.onet_code,
      title: r.title,
      title_es: r.title_es,
      aliases: split(r.aliases),
      sector: r.sector,
      typical_education: r.typical_education as Occupation["typical_education"],
      key_skills: split(r.key_skills),
      related_codes: split(r.related_codes),
      median_wage_miami: w?.annual,
      hourly_wage_miami: w?.hourly,
    };
  });
  return onetCache;
}

function loadWages(): Map<string, { annual?: number; hourly?: number }> {
  const file = path.join(DATA_DIR, "bls_miami_wages.csv");
  const map = new Map<string, { annual?: number; hourly?: number }>();
  if (!existsSync(file)) return map;
  for (const r of parseCsv(readFileSync(file, "utf8"))) {
    map.set(r.soc_code, {
      annual: r.annual_median_usd ? Number(r.annual_median_usd) : undefined,
      hourly: r.hourly_median_usd ? Number(r.hourly_median_usd) : undefined,
    });
  }
  return map;
}

let oppCache: Opportunity[] | null = null;
export function loadOpportunities(): Opportunity[] {
  oppCache ??= (JSON.parse(readFileSync(path.join(DATA_DIR, "opportunities.json"), "utf8")) as Opportunity[]).filter((o) => !o.inactive);
  return oppCache!;
}

export function getOccupation(code?: string | null): Occupation | undefined {
  if (!code) return undefined;
  return loadOnet().find((o) => o.onet_code === code);
}
