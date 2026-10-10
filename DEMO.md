# 2-minute demo script

**Before you go on stage**
- `npm run dev`, open http://localhost:3000, browser zoom 110–125%.
- Click each of the 3 demo personas once during rehearsal. They're then cached, so on stage they load instantly. (For the reskill one, pick **Computer User Support Specialists** in rehearsal so that exact path is cached.)
- Have a second tab ready on the landing page.

---

### 0:00–0:10 · Problem (10s)
> "Miami attracts talent but struggles to keep it. Newcomers don't know anyone, and residents who want a better job can't see the path: which certificate, how much it costs, what it pays. Miami City Brain maps your background to real Miami opportunities, in English or Spanish."

### 0:10–1:00 · Reskill persona, the ladder (50s)
1. On the landing page click **🪜 Hotel front-desk supervisor → better-paid career**.
2. Point at the 3-step progress: *"Gemma 4 reads her profile, our matcher finds options, Gemma 4 writes the plan."*
3. **Target picker:** *"She didn't know what she wanted, so we ranked better-paid Miami roles by how many of her skills transfer, using O\*NET and BLS wages. Note the degree badge."* Click **Computer User Support Specialists**.
4. **Wage strip:** *"Now $42k → IT Support $61k → Network Support $79k. Real BLS medians for Miami."*
5. **Step 1:** green chips = *"skills she already has from 8 years at the front desk"*, amber = *"what's missing"*. Options: *"evening or online, low-cost, no degree needed, and CareerSource can fund the training."*
6. Point at **⭐ Do this this week.**

### 1:00–1:25 · Newcomer in Spanish (25s)
1. Click the logo → **✈️ Venezuelan nurse, Spanish-first** (UI flips to ES).
2. *"María is a nurse whose license isn't transferred yet. Her whole plan is in Spanish: free English classes, immigrant services and career help, mostly free. Week by week, each item with why it fits and a next step."*

### 1:25–1:45 · How this was made (20s)
1. Click **🧠 Cómo se hizo / How this was made**.
2. *"Gemma 4 extracted this profile JSON. Then a deterministic matcher, with no LLM, scored our curated Miami dataset. Here are the scores and reasons. Gemma 4 can only cite IDs from this list. Anything else is dropped on the server: zero invented organizations."*

### 1:45–2:00 · Impact + open source (15s)
> "It's built for people without degrees and Spanish speakers, the talent Miami loses most. It's MIT-licensed, runs on open-weight Gemma 4, and the matching logic ships as an Agent Skill, so any agent can produce these plans from the same Miami data. Miami City Brain: your next step in Miami."

---

**If something breaks live:** the error screen has a **Try again** button (the wrapper already retries and falls back to `gemma-4-31b-it`). Or run another cached persona.
