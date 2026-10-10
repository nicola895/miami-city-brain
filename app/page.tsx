"use client";
import { useEffect, useState } from "react";
import { DICT } from "@/lib/i18n";
import { GOALS } from "@/lib/vocab";
import type { Candidates, Lang, Mode, NewcomerPlan, Opportunity, Profile, ReskillPlan } from "@/lib/types";
import { Progress } from "@/components/ui";
import { HowMade, type RunMeta } from "@/components/HowMade";
import { NewcomerResults, ProfileCard, ReskillResults, TargetPicker } from "@/components/Results";
import nycEngineer from "@/data/demo_personas/newcomer-nyc-engineer.json";
import nurse from "@/data/demo_personas/newcomer-venezuelan-nurse.json";
import hotel from "@/data/demo_personas/reskill-hotel-supervisor.json";

const PERSONAS = [nycEngineer, nurse, hotel] as { id: string; mode: Mode; preferred_language: Lang; text: string; label: Record<Lang, string> }[];

type Screen = "landing" | "intake" | "running" | "pick" | "results" | "error";

interface PlanResponse {
  plan: NewcomerPlan | ReskillPlan; candidates: Candidates; opportunities: Record<string, Opportunity>;
  model: string; ms: number; dropped_ids: string[]; cached?: boolean; error?: string;
}

async function post<T>(url: string, body: BodyInit, json = true): Promise<T> {
  const res = await fetch(url, { method: "POST", body, headers: json ? { "Content-Type": "application/json" } : undefined });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<Mode>("newcomer");
  const [step, setStep] = useState(1);
  const [times, setTimes] = useState<(number | undefined)[]>([]);
  const [personaId, setPersonaId] = useState<string | undefined>();
  const [profile, setProfile] = useState<Profile>();
  const [cands, setCands] = useState<Candidates>();
  const [result, setResult] = useState<PlanResponse>();
  const [meta, setMeta] = useState<RunMeta>({});
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [lastRun, setLastRun] = useState<() => void>();
  const t = DICT[lang];

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const fail = (e: unknown, retry: () => void) => { setError((e as Error).message); setLastRun(() => retry); setScreen("error"); };

  async function buildPlan(p: Profile, m: Mode, targetCode?: string, pid = personaId, l = lang) {
    setScreen("running"); setStep(3);
    const t0 = Date.now();
    try {
      const r = await post<PlanResponse>("/api/plan", JSON.stringify({ profile: p, mode: m, lang: l, targetCode, personaId: pid }));
      setTimes((x) => [x[0], x[1], Date.now() - t0]);
      setResult(r); setCands(r.candidates);
      setMeta((x) => ({ ...x, plan: { model: r.model, ms: r.ms, cached: r.cached, dropped_ids: r.dropped_ids } }));
      setScreen("results");
      window.scrollTo(0, 0);
    } catch (e) { fail(e, () => buildPlan(p, m, targetCode, pid, l)); }
  }

  async function matchAndPlan(p: Profile, m: Mode, pid = personaId, l = lang) {
    setScreen("running"); setStep(2);
    const t0 = Date.now();
    try {
      const c = await post<Candidates>("/api/match", JSON.stringify({ profile: p, mode: m }));
      setTimes((x) => [x[0], Date.now() - t0]);
      setCands(c);
      if (m === "reskill" && !c.target) { setScreen("pick"); return; }
      await buildPlan(p, m, c.target?.onet_code, pid, l);
    } catch (e) { fail(e, () => matchAndPlan(p, m, pid, l)); }
  }

  async function run(fd: FormData, m: Mode, pid?: string, l = lang) {
    setScreen("running"); setStep(1); setTimes([]); setMeta({}); setResult(undefined); setPersonaId(pid);
    fd.set("mode", m); fd.set("lang", l);
    if (pid) fd.set("persona", pid);
    const t0 = Date.now();
    try {
      const r = await post<{ profile: Profile; model: string; ms: number; cached?: boolean }>("/api/extract", fd, false);
      setTimes([Date.now() - t0]);
      setProfile(r.profile);
      setMeta({ extract: { model: r.model, ms: r.ms, cached: r.cached } });
      await matchAndPlan(r.profile, m, pid, l);
    } catch (e) { fail(e, () => run(fd, m, pid, l)); }
  }

  function runPersona(id: string) {
    const p = PERSONAS.find((x) => x.id === id)!;
    setMode(p.mode); setLang(p.preferred_language);
    const fd = new FormData();
    fd.set("text", p.text);
    run(fd, p.mode, p.id, p.preferred_language);
  }

  const reset = () => { setScreen("landing"); setResult(undefined); setProfile(undefined); setCands(undefined); };

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <button onClick={reset} className="flex items-center gap-2 font-bold">
            <span className="text-2xl">🌴</span> Miami City Brain
          </button>
          <div className="flex items-center gap-2">
            {(screen === "results" || screen === "pick") && (
              <button onClick={() => setDrawer(true)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium">🧠 {t.howMade}</button>
            )}
            <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold">
              {(["en", "es"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 ${lang === l ? "bg-slate-900 text-white" : "bg-white"}`}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {screen === "landing" && (
          <div className="py-6">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {t.tagline.split(",")[0]},<span className="bg-gradient-to-r from-teal-600 to-rose-500 bg-clip-text text-transparent">{t.tagline.split(",").slice(1).join(",")}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-600">{t.sub}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <ModeCard emoji="✈️" title={t.newcomerTitle} desc={t.newcomerDesc} color="from-rose-500 to-orange-400" onClick={() => { setMode("newcomer"); setScreen("intake"); }} />
              <ModeCard emoji="🪜" title={t.reskillTitle} desc={t.reskillDesc} color="from-teal-600 to-cyan-500" onClick={() => { setMode("reskill"); setScreen("intake"); }} />
            </div>
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold text-slate-500">{t.tryDemo}</p>
              <div className="flex flex-wrap gap-2">
                {PERSONAS.map((p) => (
                  <button key={p.id} onClick={() => runPersona(p.id)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-teal-500">
                    {p.mode === "reskill" ? "🪜" : "✈️"} {p.label[lang]}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-10 text-xs text-slate-400">⚡ {t.poweredBy} · <code>gemma-4-26b-a4b-it</code> · MIT open source</p>
          </div>
        )}

        {screen === "intake" && <Intake mode={mode} lang={lang} onBack={() => setScreen("landing")} onSubmit={(fd) => run(fd, mode)} onPersona={runPersona} />}

        {screen === "running" && <div className="py-10"><Progress step={step} t={t} times={times} /></div>}

        {screen === "pick" && cands?.target_options && profile && (
          <TargetPicker options={cands.target_options} lang={lang} t={t} onPick={(code) => buildPlan(profile, "reskill", code)} />
        )}

        {screen === "results" && result && profile && cands && (
          <div className="space-y-6">
            <div className="no-print flex flex-wrap items-center justify-between gap-2">
              <Badge2>{mode === "reskill" ? `🪜 ${t.reskillTitle}` : `✈️ ${t.newcomerTitle}`}</Badge2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">🖨 {t.print}</button>
                <button onClick={reset} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">{t.startOver}</button>
              </div>
            </div>
            <ProfileCard key={JSON.stringify(profile)} profile={profile} lang={lang} t={t} busy={false}
              onRerun={(p) => { setProfile(p); setPersonaId(undefined); matchAndPlan(p, mode, undefined); }} />
            {mode === "reskill"
              ? <ReskillResults plan={result.plan as ReskillPlan} cands={cands} profile={profile} opps={result.opportunities} lang={lang} t={t} />
              : <NewcomerResults plan={result.plan as NewcomerPlan} cands={cands} opps={result.opportunities} lang={lang} t={t} />}
            <p className="no-print text-center text-xs text-slate-400">
              {meta.plan?.model} · {meta.plan?.cached ? t.fromCache : `${((meta.extract?.ms ?? 0) + (meta.plan?.ms ?? 0)) / 1000}s`} ·{" "}
              <button className="underline" onClick={() => setDrawer(true)}>{t.howMade}</button>
            </p>
          </div>
        )}

        {screen === "error" && (
          <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <p className="font-semibold text-rose-800">{t.error}</p>
            <p className="mt-1 text-sm text-rose-700">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              {lastRun && <button onClick={lastRun} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white">{t.retry}</button>}
              <button onClick={reset} className="rounded-lg border border-rose-300 px-4 py-2 text-sm">{t.startOver}</button>
            </div>
          </div>
        )}
      </main>

      <HowMade open={drawer} onClose={() => setDrawer(false)} t={t} profile={profile} candidates={cands} meta={meta} />
    </div>
  );
}

function Badge2({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{children}</span>;
}

function ModeCard({ emoji, title, desc, color, onClick }: { emoji: string; title: string; desc: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`group rounded-3xl bg-gradient-to-br ${color} p-6 text-left text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}>
      <div className="text-4xl">{emoji}</div>
      <div className="mt-3 text-2xl font-bold">{title}</div>
      <p className="mt-2 text-white/90">{desc}</p>
      <div className="mt-4 font-semibold">→</div>
    </button>
  );
}

function Intake({ mode, lang, onBack, onSubmit, onPersona }: {
  mode: Mode; lang: Lang; onBack: () => void; onSubmit: (fd: FormData) => void; onPersona: (id: string) => void;
}) {
  const t = DICT[lang];
  const [goals, setGoals] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<string[]>([]);
  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const relevantGoals = mode === "reskill"
    ? ["change_career", "higher_pay", "stable_hours", "get_certified", "find_mentor", "learn_english"]
    : ["meet_people", "find_job", "find_mentor", "start_business", "learn_english", "transfer_license"];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = new FormData(e.currentTarget);
    const fd = new FormData();
    const file = raw.get("file");
    if (file instanceof File && file.size) fd.set("file", file);
    fd.set("text", String(raw.get("text") || ""));
    const hints = {
      current_role: String(raw.get("current_role") || "") || undefined,
      skills: String(raw.get("skills") || "").split(",").map((s) => s.trim()).filter(Boolean),
      goals,
      target_role: String(raw.get("target_role") || "") || undefined,
      budget: String(raw.get("budget") || "") || undefined,
      hours_per_week: Number(raw.get("hours")) || undefined,
      schedule,
      neighborhood: String(raw.get("neighborhood") || "") || undefined,
      no_degree: raw.get("no_degree") === "on",
    };
    fd.set("hints", JSON.stringify(hints));
    onSubmit(fd);
  }

  const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none";
  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
      <button type="button" onClick={onBack} className="text-sm text-slate-500">← {t.back}</button>
      <div>
        <h2 className="text-3xl font-bold">{t.aboutYou}</h2>
        <p className="text-slate-600">{t.aboutYouSub}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-slate-500">{t.tryDemo}:</span>
        {PERSONAS.filter((p) => p.mode === mode).map((p) => (
          <button type="button" key={p.id} onClick={() => onPersona(p.id)} className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100">
            ▶ {p.label[lang]}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-semibold">{t.uploadCv}</label>
        <input type="file" name="file" accept="application/pdf" className="mt-1 text-sm" />
        <label className="mt-3 block text-sm font-semibold">{t.orPaste}</label>
        <textarea name="text" rows={4} placeholder={t.pastePh} className={input} />
        <p className="mt-2 text-xs text-emerald-700">🔒 {t.privacy}</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <Field label={t.currentRole}><input name="current_role" className={input} /></Field>
        <Field label={t.neighborhood}><input name="neighborhood" className={input} placeholder="Hialeah, Doral, Brickell…" /></Field>
        <div className="sm:col-span-2"><Field label={t.skills}><input name="skills" className={input} /></Field></div>
        {mode === "reskill" && <div className="sm:col-span-2"><Field label={t.targetRole}><input name="target_role" className={input} /></Field></div>}
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-semibold">{t.goals}</p>
          <div className="flex flex-wrap gap-2">
            {relevantGoals.filter((g) => (GOALS as readonly string[]).includes(g)).map((g) => (
              <button type="button" key={g} onClick={() => toggle(goals, g, setGoals)}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${goals.includes(g) ? "bg-teal-600 text-white ring-teal-600" : "bg-white ring-slate-300"}`}>
                {t.goalLabels[g]}
              </button>
            ))}
          </div>
        </div>
        <Field label={t.budget}>
          <select name="budget" className={input} defaultValue="">
            <option value="">—</option><option value="free">{t.budgetFree}</option><option value="low">{t.budgetLow}</option><option value="any">{t.budgetAny}</option>
          </select>
        </Field>
        <Field label={t.hours}><input name="hours" type="number" min={0} max={60} className={input} /></Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-semibold">{t.schedule}</p>
          <div className="flex flex-wrap gap-2">
            {([["evenings", t.evenings], ["weekends", t.weekends], ["online", t.online], ["full-time", t.fulltime]] as const).map(([v, l]) => (
              <button type="button" key={v} onClick={() => toggle(schedule, v, setSchedule)}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${schedule.includes(v) ? "bg-teal-600 text-white ring-teal-600" : "bg-white ring-slate-300"}`}>{l}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="no_degree" /> {t.noDegree}</label>
      </div>
      <button type="submit" className="w-full rounded-2xl bg-slate-900 py-3 text-lg font-semibold text-white hover:bg-slate-800">{t.build} →</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>;
}
