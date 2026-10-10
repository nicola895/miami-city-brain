"use client";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { TYPE_LABEL } from "@/lib/i18n";
import type { Lang, Opportunity } from "@/lib/types";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "teal" | "amber" | "green" | "coral" | "violet" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    teal: "bg-teal-100 text-teal-800",
    amber: "bg-amber-100 text-amber-900",
    green: "bg-emerald-100 text-emerald-800",
    coral: "bg-rose-100 text-rose-800",
    violet: "bg-violet-100 text-violet-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Chip({ children, tone, onRemove }: { children: React.ReactNode; tone: "green" | "amber" | "slate"; onRemove?: () => void }) {
  const tones = {
    green: "border-emerald-300 bg-emerald-50 text-emerald-800",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    slate: "border-slate-300 bg-white text-slate-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${tones[tone]}`}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="no-print -mr-1 ml-0.5 text-slate-400 hover:text-slate-700" aria-label="remove">×</button>
      )}
    </span>
  );
}

export function CopyBox({ text, t }: { text: string; t: Dict }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{t.introMsg}</h3>
        <button
          className="no-print rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
        >
          {done ? t.copied : t.copy}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{text}</p>
    </div>
  );
}

const costTone = (c: string) => (c === "free" ? "green" : c === "low" ? "teal" : "slate") as "green" | "teal" | "slate";

export function OppCard({ o, lang, t, why, next, compact }: {
  o?: Opportunity; lang: Lang; t: Dict; why?: string; next?: string; compact?: boolean;
}) {
  if (!o) return null;
  const costLabel = (t as unknown as Record<string, string>)[o.cost] ?? o.cost;
  const sched: Record<string, string> = { evenings: t.evenings, weekends: t.weekends, online: t.online, "full-time": t.fulltime };
  return (
    <div className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <a href={o.url} target="_blank" rel="noreferrer" className="font-semibold text-slate-900 hover:text-teal-700 hover:underline">
            {o.name}
          </a>
          {o.neighborhood && <span className="ml-1 text-xs text-slate-500">· {o.neighborhood}</span>}
        </div>
        <Badge tone="violet">{TYPE_LABEL[lang][o.type] ?? o.type}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge tone={costTone(o.cost)}>{costLabel}</Badge>
        {o.duration && <Badge>{o.duration}</Badge>}
        {o.schedule?.map((s) => <Badge key={s}>{sched[s] ?? s}</Badge>)}
        {o.no_degree_friendly && <Badge tone="teal">✓ {t.noDegreeBadge}</Badge>}
        {o.languages.includes("es") && <Badge>ES</Badge>}
        {o.needs_verification && <Badge tone="amber">{t.needsVerification}</Badge>}
      </div>
      {o.cost_note && !compact && <p className="mt-1 text-xs text-slate-500">{o.cost_note}</p>}
      {why && <p className="mt-2 text-sm text-slate-700">{why}</p>}
      {next && (
        <p className="mt-2 text-sm font-medium text-teal-800">→ {next}</p>
      )}
      <a href={o.url} target="_blank" rel="noreferrer" className="no-print mt-2 inline-block text-xs text-teal-700 underline">
        {t.open} ↗
      </a>
      <span className="print-only text-xs text-slate-500">{o.url}</span>
    </div>
  );
}

export function Progress({ step, t, times }: { step: number; t: Dict; times: (number | undefined)[] }) {
  const steps = [t.step1, t.step2, t.step3];
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal-500" /> {t.gemmaWorking} · gemma-4-26b-a4b-it
      </p>
      <ol className="space-y-3">
        {steps.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "active" : "todo";
          return (
            <li key={label} className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                state === "done" ? "bg-teal-600 text-white" : state === "active" ? "animate-pulse bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-400"}`}>
                {state === "done" ? "✓" : n}
              </span>
              <span className={state === "todo" ? "text-slate-400" : "text-slate-900"}>{label}</span>
              {times[i] !== undefined && <span className="ml-auto text-xs text-slate-400">{(times[i]! / 1000).toFixed(1)}{t.seconds}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
