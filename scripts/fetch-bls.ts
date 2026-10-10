// Rebuilds data/bls_miami_wages.csv from the BLS public API (OEWS, no key needed).
// Area 33100 = Miami-Fort Lauderdale-West Palm Beach, FL MSA. Datatype 13 = annual median wage.
// Run: npx tsx scripts/fetch-bls.ts
import { writeFileSync } from "node:fs";
import { loadOnet } from "../lib/data";

const AREA = "0033100";
const seriesId = (soc6: string, dt: string) => `OEUM${AREA}000000${soc6}${dt}`;

async function fetchBatch(ids: string[]) {
  const res = await fetch("https://api.bls.gov/publicAPI/v1/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesid: ids }),
  });
  const json = await res.json();
  if (json.status !== "REQUEST_SUCCEEDED") throw new Error(JSON.stringify(json.message));
  const out: Record<string, { year: string; value: string }> = {};
  for (const s of json.Results.series) {
    const d = s.data?.[0];
    if (d) out[s.seriesID] = { year: d.year, value: d.value };
  }
  return out;
}

async function main() {
  const occs = loadOnet();
  const socs = [...new Set(occs.map((o) => o.onet_code.slice(0, 7).replace("-", "")))];
  const ids = socs.flatMap((s) => [seriesId(s, "13"), seriesId(s, "08")]);
  const results: Record<string, { year: string; value: string }> = {};
  for (let i = 0; i < ids.length; i += 25) Object.assign(results, await fetchBatch(ids.slice(i, i + 25)));

  const rows = ["soc_code,annual_median_usd,hourly_median_usd,year,area"];
  for (const s of socs) {
    const a = results[seriesId(s, "13")];
    const h = results[seriesId(s, "08")];
    const num = (v?: { value: string }) => (v && /^[\d.]+$/.test(v.value) ? v.value : "");
    rows.push(`${s.slice(0, 2)}-${s.slice(2)},${num(a)},${num(h)},${a?.year ?? h?.year ?? ""},Miami-Fort Lauderdale-West Palm Beach FL MSA`);
  }
  writeFileSync("data/bls_miami_wages.csv", rows.join("\n") + "\n");
  const missing = rows.filter((r) => r.includes(",,,")).length;
  console.log(`Wrote ${rows.length - 1} occupations (${missing} without Miami data).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
