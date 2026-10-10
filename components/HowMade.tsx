"use client";
import type { Dict } from "@/lib/i18n";
import type { Candidates, Profile } from "@/lib/types";

export interface RunMeta {
  extract?: { model: string; ms: number; cached?: boolean };
  plan?: { model: string; ms: number; cached?: boolean; dropped_ids: string[] };
}

export function HowMade({ open, onClose, t, profile, candidates, meta }: {
  open: boolean; onClose: () => void; t: Dict; profile?: Profile; candidates?: Candidates; meta: RunMeta;
}) {
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🧠 {t.howMade}</h2>
          <button onClick={onClose} className="rounded-lg px-2 text-2xl text-slate-500">×</button>
        </div>
        <p className="mb-4 text-sm text-slate-500">{t.howMadeSub}</p>

        <div className="mb-4 rounded-xl bg-slate-900 p-3 font-mono text-xs text-emerald-300">
          {t.model}: {meta.plan?.model ?? meta.extract?.model ?? "gemma-4-26b-a4b-it"} (Gemma 4, open weights) · Google Gemini API
          <br />
          extract: {meta.extract ? `${(meta.extract.ms / 1000).toFixed(1)}s${meta.extract.cached ? " (cached)" : ""}` : "-"} · plan:{" "}
          {meta.plan ? `${(meta.plan.ms / 1000).toFixed(1)}s${meta.plan.cached ? " (cached)" : ""}` : "-"}
        </div>

        <Section title={t.extracted}>
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(profile, null, 2)}</pre>
        </Section>

        <Section title={t.candidates}>
          {candidates?.ladder && (
            <pre className="mb-2 max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
              {JSON.stringify(candidates.ladder.map(({ step, onet_code, title, median_wage_miami, transferable_skills, skills_to_build }) =>
                ({ step, onet_code, title, median_wage_miami, transferable_skills, skills_to_build })), null, 1)}
            </pre>
          )}
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1 pr-2">id</th><th className="pr-2">{t.score}</th><th>{t.reasons}</th></tr></thead>
            <tbody>
              {candidates?.items.map((i) => (
                <tr key={i.opportunity.id} className="border-t border-slate-100 align-top">
                  <td className="py-1 pr-2 font-mono">{i.opportunity.id}</td>
                  <td className="pr-2">{i.score}</td>
                  <td className="text-slate-600">{i.reasons.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title={t.planStep}>
          <p className="text-sm">
            {t.dropped}:{" "}
            <span className="font-mono">{meta.plan?.dropped_ids.length ? meta.plan.dropped_ids.join(", ") : t.none}</span>
          </p>
        </Section>
        <p className="mt-4 text-xs text-slate-500">{t.wageNote}</p>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}
