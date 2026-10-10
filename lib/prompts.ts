// Loads /prompts/*.md templates (shared with the Agent Skill) and fills {{placeholders}}.
import { readFileSync } from "node:fs";
import path from "node:path";

export function renderPrompt(name: string, vars: Record<string, string | number>): string {
  const tpl = readFileSync(path.join(process.cwd(), "prompts", `${name}.md`), "utf8");
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));
}
