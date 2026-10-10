---
name: miami-city-brain
description: Match a person's background, goals and CV to real Miami opportunities and produce either a first-30-days newcomer plan (communities, meetups, mentorship programs, career services) or a reskilling career ladder (transferable skills, skill gaps, Miami trainings with cost/schedule, BLS Miami wages per step). Use when someone is new to Miami and wants to build a network, or lives in Miami-Dade and wants to change careers, upskill, or find training — in English or Spanish.
license: MIT
metadata:
  version: "0.1.0"
  model: gemma-4-26b-a4b-it (reference app; any capable model can follow this skill)
  data_as_of: "2026-10-10"
---

# Miami City Brain

Turn a person's profile into a **grounded** Miami action plan. The plan may only use organizations from the curated dataset — never invent organizations, events, dates, prices, people or contact details.

All paths below are relative to the repository root (this skill lives in `skills/miami-city-brain/` and shares data and prompts with the web app).

## Data
- `data/opportunities.json` — ~65 real Miami resources (communities, meetups, mentorship programs, career services, trainings, certificates, apprenticeships). Fields: `type`, `cost`, `schedule`, `languages`, `audience_tags`, `sector_tags`, `skills_taught`, `no_degree_friendly`, `modes`, `needs_verification`.
- `data/onet_subset.csv` — 82 O*NET-SOC occupations with key skills (controlled vocabulary), typical education and related occupations.
- `data/bls_miami_wages.csv` — BLS OEWS May 2025 median wages for the Miami–Fort Lauderdale–West Palm Beach MSA.
- `lib/vocab.ts` — the controlled vocabulary for skills, sectors and goals.

## Workflow

### 1. Choose the mode
- **newcomer** — new to Miami, no local network → 4-week plan.
- **reskill** — lives in Miami, wants a new career → career ladder.

### 2. Extract a profile
Follow `prompts/extract_profile.md` (fill `{{text}}` with the CV / description, `{{mode}}`, `{{lang}}`, and the tag lists from `lib/vocab.ts`; the occupation list comes from `data/onet_subset.csv`). Output the profile JSON exactly as specified. Do not include names, emails or phone numbers. Do not store the CV.

### 3. Retrieve candidates (deterministic — run the script, don't guess)
Save the profile to a file and run:

```bash
npx tsx skills/miami-city-brain/scripts/match.ts --mode reskill --profile profile.json
```

- **Reskill without a target role:** the output has `target_options` (3 better-paid roles ranked by skill overlap, Miami wage and education fit). Present them and let the person choose, then rerun with `--target <onet_code>`.
- **Reskill with a target:** the output has `ladder` (bridge → target → next step, with `transferable_skills`, `skills_to_build`, `median_wage_miami` and `training_candidate_ids` per step) and `candidates`.
- **Newcomer:** the output has `candidates` and `target_options` (career paths near their background).

### 4. Write the plan
Follow `prompts/plan_newcomer.md` or `prompts/plan_reskill.md`, filling the placeholders with the profile, the `candidates` list and (reskill) the `ladder`.
- Use **only** `opportunity_id`s from `candidates`. Drop anything else.
- Keep roles, O*NET codes, wages and skill lists from the ladder exactly as computed.
- Respect constraints: budget, hours/week, schedule, degree, transport, family.
- Write in the person's preferred language (English or Spanish).
- If an item has `needs_verification: true`, tell the person to confirm details on the official site.

### 5. Present it
- **Newcomer:** short summary → Week 1–4 with 2–4 items each (name, why it fits, concrete next step, link) → 2–3 career paths with Miami median wage → a copy-ready intro message.
- **Reskill:** summary → Now (current pay) → Bridge → Target with Miami wage at each step → per step: skills they have (✓), skills to build (+), 2–3 Miami options with cost/duration/schedule and "no degree needed" → **one action to do this week** → communities for the target field → intro message.

Always cite: "Wages: BLS OEWS May 2025, Miami–Fort Lauderdale–West Palm Beach MSA. Skills & career paths: O*NET OnLine (onetonline.org)."
