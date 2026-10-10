// Tolerant JSON parser for model output: strips fences/prose, fixes trailing commas.
export function parseJsonTolerant(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const start = s.search(/[{[]/);
  if (start === -1) throw new Error("No JSON object found in model output");
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) throw new Error("Unterminated JSON in model output");
  s = s.slice(start, end + 1);

  try {
    return JSON.parse(s);
  } catch {
    const fixed = s
      .replace(/,\s*([}\]])/g, "$1") // trailing commas
      .replace(/[“”]/g, '"') // smart quotes
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); // control chars
    return JSON.parse(fixed);
  }
}
