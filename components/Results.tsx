"use client";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { fmtWage } from "@/lib/i18n";
import { skillLabel } from "@/lib/vocab";
import type { Candidates, Lang, NewcomerPlan, Opportunity, Profile, ReskillPlan, TargetOption } from "@/lib/types";
import { Badge, Chip, CopyBox, OppCard } from "./ui";

type Opps = Record<string, Opportunity>;

// ---------- Target picker (reskill, no target given) ----------

export function TargetPicker({ options, lang, t, onPick }: { options: TargetOption[]; lang: Lang; t: Dict; onPick: (code: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl font-bold">{t.pickTarget}</h2>
      <p className="mb-4 text-slate-600">{t.pickTargetSub}</p>
      <div className="grid gap-3">
        {options.map((o) => (
          <button key={o.onet_code} onClick={() => onPick(o.onet_code)}
            className="rounded-2xl border-2 border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-500 hover:shadow">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-semibold">{lang === "es" ? o.title_es : o.title}</span>
              <span className="text-lg font-bold text-teal-700">{fmtWage(o.median_wage_miami)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              O*NET {o.onet_code} · {t.medianMiami}
              {o.typical_education === "bachelor" ? <Badge tone="amber">🎓 {t.degreeUsual}</Badge> : <Badge tone="teal">✓ {t.noDegreeBadge}</Badge>}
            </div>
            <div className="mt-2 text-sm text-slate-700">
              <b>{Math.round(o.skill_overlap * 100)}%</b> {t.skillsMatch}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {o.transferable_skills.map((s) => <Chip key={s} tone="green">{skillLabel(s, lang)}</Chip>)}
              {o.skills_to_build.map((s) => <Chip key={s} tone="amber">+ {skillLabel(s, lang)}</Chip>)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Reskill ladder ----------

export function ReskillResults({ plan, cands, profile, opps, lang, t }: {
  plan: ReskillPlan; cands: Candidates; profile: Profile; opps: Opps; lang: Lang; t: Dict;
}) {
  const nowPay = profile.current_pay_annual ?? cands.current?.median_wage_miami;
  const targetIdx = plan.ladder.findIndex((st) => st.onet_code === cands.target?.onet_code);
  const labelFor = (i: number) => (i === targetIdx ? t.target : i < targetIdx ? t.bridge : t.next);
  return (
    <div className="space-y-6">
      <p className="text-lg text-slate-700">{plan.summary}</p>

      {/* Wage strip */}
      <div className="flex items-stretch gap-1 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
        <WageStep label={t.now} role={profile.current_role} wage={nowPay} note={profile.current_pay_annual ? t.yourPay : t.medianMiami} muted />
        {plan.ladder.map((st, i) => (
          <div key={st.step} className="flex items-center gap-1">
            <span className="text-2xl text-teal-500">→</span>
            <WageStep label={labelFor(i)} role={st.role} wage={st.median_wage_miami} note={t.medianMiami} />
          </div>
        ))}
      </div>

      {/* Steps */}
      <ol className="relative space-y-6 border-l-4 border-teal-200 pl-5">
        {plan.ladder.map((st, i) => (
          <li key={st.step} className="relative break-inside-avoid">
            <span className="absolute -left-[34px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">{st.step}</span>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <Badge tone="teal">{labelFor(i)}</Badge>
                  <h3 className="mt-1 text-xl font-bold">{st.role}</h3>
                  <p className="text-xs text-slate-500">O*NET {st.onet_code}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-teal-700">{fmtWage(st.median_wage_miami)}</div>
                  <div className="text-xs text-slate-500">{t.medianMiami}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">{t.youHave}</p>
                  <div className="flex flex-wrap gap-1">{st.transferable_skills.map((s) => <Chip key={s} tone="green">✓ {skillLabel(s, lang)}</Chip>)}</div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-amber-700">{t.toBuild}</p>
                  <div className="flex flex-wrap gap-1">{st.skills_to_build.map((s) => <Chip key={s} tone="amber">+ {skillLabel(s, lang)}</Chip>)}</div>
                </div>
              </div>
              {st.est_time_to_reach && <p className="mt-3 text-sm text-slate-600">⏱ {t.timeToReach}: <b>{st.est_time_to_reach}</b></p>}
              {st.next_action_this_week && (
                <div className={`mt-3 rounded-xl p-3 ${i === 0 ? "bg-amber-100 ring-2 ring-amber-400" : "bg-slate-50"}`}>
                  <p className="text-xs font-bold uppercase text-amber-800">⭐ {t.doThisWeek}</p>
                  <p className="text-sm font-medium text-slate-900">{st.next_action_this_week}</p>
                </div>
              )}
              <p className="mb-2 mt-4 text-sm font-semibold">{t.options}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {st.options.map((op) => <OppCard key={op.opportunity_id} o={opps[op.opportunity_id]} why={op.why} lang={lang} t={t} compact />)}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {plan.network_items.length > 0 && (
        <section>
          <h3 className="mb-2 text-lg font-bold">🤝 {t.network}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.network_items.map((n) => <OppCard key={n.opportunity_id} o={opps[n.opportunity_id]} why={n.why} lang={lang} t={t} compact />)}
          </div>
        </section>
      )}
      <CopyBox text={plan.first_message_template} t={t} />
      <p className="text-xs text-slate-500">{t.wageNote} {t.verify}</p>
    </div>
  );
}

function WageStep({ label, role, wage, note, muted }: { label: string; role: string; wage?: number; note: string; muted?: boolean }) {
  return (
    <div className={`min-w-[120px] rounded-xl p-3 ${muted ? "bg-slate-100" : "bg-teal-50"}`}>
      <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
      <div className="line-clamp-2 text-sm font-semibold leading-tight">{role}</div>
      <div className={`text-xl font-bold ${muted ? "text-slate-600" : "text-teal-700"}`}>{fmtWage(wage)}</div>
      <div className="text-[10px] text-slate-500">{note}</div>
    </div>
  );
}

// ---------- Newcomer timeline ----------

export function NewcomerResults({ plan, cands, opps, lang, t }: { plan: NewcomerPlan; cands: Candidates; opps: Opps; lang: Lang; t: Dict }) {
  const wages = Object.fromEntries((cands.target_options ?? []).map((o) => [o.onet_code, o.median_wage_miami]));
  return (
    <div className="space-y-6">
      <p className="text-lg text-slate-700">{plan.summary}</p>
      <ol className="relative space-y-6 border-l-4 border-rose-200 pl-5">
        {plan.weeks.map((w) => (
          <li key={w.week} className="relative">
            <span className="absolute -left-[38px] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">{w.week}</span>
            <h3 className="text-lg font-bold">{t.week} {w.week}: <span className="font-semibold text-slate-700">{w.focus}</span></h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {w.items.map((it) => <OppCard key={it.opportunity_id} o={opps[it.opportunity_id]} why={it.why_it_fits} next={it.next_step} lang={lang} t={t} />)}
            </div>
          </li>
        ))}
      </ol>
      {plan.career_paths.length > 0 && (
        <section className="break-inside-avoid">
          <h3 className="mb-2 text-lg font-bold">🧭 {t.careerPaths}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {plan.career_paths.map((c) => (
              <div key={c.onet_code} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-semibold">{c.title}</div>
                <div className="text-xl font-bold text-teal-700">{fmtWage(wages[c.onet_code])}</div>
                <div className="text-xs text-slate-500">{t.medianMiami} · O*NET {c.onet_code}</div>
                <p className="mt-1 text-sm text-slate-700">{c.why}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <CopyBox text={plan.first_message_template} t={t} />
      <p className="text-xs text-slate-500">{t.wageNote} {t.verify}</p>
    </div>
  );
}

// ---------- Profile card (editable chips -> re-run) ----------

export function ProfileCard({ profile, lang, t, onRerun, busy }: {
  profile: Profile; lang: Lang; t: Dict; onRerun: (p: Profile) => void; busy: boolean;
}) {
  const [p, setP] = useState(profile);
  const [adding, setAdding] = useState("");
  const dirty = JSON.stringify(p) !== JSON.stringify(profile);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{t.profile}</p>
          <p className="font-semibold">{p.current_role}{p.years_experience ? ` · ${p.years_experience}y` : ""}</p>
          <p className="text-xs text-slate-500">
            {[p.neighborhood, p.languages.join("/").toUpperCase(), p.has_us_degree ? "🎓" : t.noDegreeBadge.toLowerCase(),
              p.constraints.hours_per_week ? `${p.constraints.hours_per_week} h/wk` : null, p.constraints.budget].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {p.skill_tags.map((s) => (
          <Chip key={s} tone="slate" onRemove={() => setP({ ...p, skill_tags: p.skill_tags.filter((x) => x !== s) })}>{skillLabel(s, lang)}</Chip>
        ))}
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && adding.trim()) {
              const tag = adding.trim().toLowerCase().replace(/\s+/g, "_");
              setP({ ...p, skill_tags: [...new Set([...p.skill_tags, tag])] });
              setAdding("");
            }
          }}
          placeholder="+ skill"
          className="no-print w-24 rounded-full border border-dashed border-slate-300 px-2 text-xs"
        />
      </div>
      <div className="no-print mt-2 flex flex-wrap items-center gap-2 text-xs">
        <select value={p.constraints.budget} onChange={(e) => setP({ ...p, constraints: { ...p.constraints, budget: e.target.value } })}
          className="rounded border border-slate-300 px-1 py-0.5">
          <option value="free">{t.budgetFree}</option><option value="low">{t.budgetLow}</option><option value="any">{t.budgetAny}</option>
        </select>
        {dirty && (
          <button disabled={busy} onClick={() => onRerun(p)} className="rounded-lg bg-teal-600 px-3 py-1 font-medium text-white disabled:opacity-50">
            ↻ {t.rerun}
          </button>
        )}
      </div>
    </div>
  );
}
