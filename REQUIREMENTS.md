# Kepli — Requirements & Build Plan

**Kepli** catches you drifting from your long-term goals before months are gone.

Not a habit tracker. Not a to-do app. It compares what you **said** you'd do against what you
**actually** did, and tells you the honest gap early.

- **Status:** v1 in development
- **Timeline:** Aug 1 – Aug 28 2026 (public beta), then Sep–Oct hardening
- **Constraint:** 1–2 hrs/day, solo, $0 budget (free tiers only, no card)
- **License:** AGPL-3.0-only

---

## 1. The problem

People set long-term goals and quietly drift. Not a dramatic quit — a slow slip nobody
notices until the year is gone.

Two root causes, both must be designed for:

1. **The day job eats the time.** By evening there's nothing left.
2. **You don't know what to do today.** Deciding is the step that fails.

**Design law: REMOVE THE DECISION, don't just record the failure.**
A tracker that only logs misses is a journal with extra steps. Kepli must tell you what
today's one action is, before you have to think about it.

## 2. Who it's for

Someone who already has a real long-term goal and keeps slipping. Not a beginner looking
for direction — they have the goal, they lose the thread.

Primary user is the builder herself: a documented year of missed goals (June target missed,
mid-July target missed, a 7-day streak that produced zero posts, three separate "locked
plans" that went stale).

## 3. Non-goals for v1

Explicitly **not** building: social/sharing/public profiles, streaks & badges & leaderboards,
push notifications or reminders, calendar or tool integrations, a native mobile app, payments,
an AI chat companion persona, teams/multi-user, habit tracking (this is **goals**, not habits).

> **Rule:** anything not in §4 goes in `v2-ideas.md`. It does not get built.

---

## 4. v1 features (build exactly these, in this order)

### F1 — Goals
Create a long-term goal with a title, a "why", and a deadline.
Break it into **monthly milestones** → **weekly commitments** (e.g. "3 posts/week", "5 build sessions/week").

### F2 — Today screen ⭐
Shows **ONE pre-decided action** for today, derived from the weekly commitments.
Never a blank box. This is the fix for "I didn't know what to do."

### F3 — Daily check-in
Under 60 seconds. Free-text note + tick which commitments were hit. Stored with a date.

### F4 — AI drift detection ⭐ (the core)
Reads check-in history against the stated plan and returns an honest verdict with pace math:

> "You said 5 posts a week. You've done 1 in 9 days. At this rate you miss by October."

Must be **specific and numeric**, never vague encouragement.

### F5 — Scoring & points
Points per day, running weekly total, pace vs. the goal deadline.

### F6 — Goal repetition
The goal is visible on every screen and every check-in. Combats "fog" — losing sight of what
you're aiming at.

### F7 — Weekly review
Auto-generated Sunday summary: what shipped, what slipped, honest verdict, recalculated pace.

### F8 — The floor
User defines a worst-day minimum (e.g. "1 post + 1 commit"). **Hitting the floor counts as a
real day, not a failure.** This is what keeps the streak alive on a heavy work day.

---

## 5. Tech stack (verified July 2026)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | |
| Styling | Tailwind CSS | |
| Hosting | Vercel free tier | ⚠️ `.vercel.app` will **not** rank on Google — shared subdomain, deprioritised. Fine for beta. Buy a domain later. |
| DB + Auth | Supabase free tier (Postgres) | Row Level Security **on** for every table |
| LLM | **Groq free tier** | No card. Production allowed. Contractually barred from training on inputs. |
| PWA | manifest + installable | No App Store fee |

**Model routing:**
- `llama-3.3-70b-versatile` → drift verdicts, weekly reviews (judgment quality matters). **1,000 req/day**
- `llama-3.1-8b-instant` → cheap/bulk calls. **14,400 req/day, 30 req/min, 6k tokens/min**

**Hard rules:**
- Provider-agnostic model layer from day one → swapping to Claude must be a one-line change.
- **No Ollama** (Vercel serverless cannot host it).
- **Avoid** Gemini free tier (trains on submissions) and Mistral / GitHub Models ("not for production").
- No embeddings needed in v1 — this is not a RAG product.
- `.env.local` must be gitignored. Never commit the Groq key or the Supabase service-role key.

---

## 6. Data model

```sql
users          -- supabase auth

goals          (id, user_id, title, why, deadline, created_at)
milestones     (id, goal_id, title, target_date, status)
commitments    (id, goal_id, title, cadence, target_per_week)
checkins       (id, user_id, date, note, commitments_hit jsonb, points, score)
drift_checks   (id, goal_id, date, verdict, gap_analysis, pace_math jsonb)
reviews        (id, goal_id, week_start, summary, verdict)
floors         (id, user_id, definition)
waitlist       (id, email, created_at)
```

RLS on every table: a user reads and writes only their own rows.

---

## 7. Build phases

### Week 1 (Aug 1–7) — foundation + goals
- [x] Scaffold Next.js + TS + Tailwind, AGPL licence, public repo
- [ ] Deploy to Vercel, get the live URL
- [ ] Supabase project + client wired up, `.env.local` set
- [ ] Auth (email + Google), protected routes
- [ ] Schema migration for all tables + RLS policies
- [ ] **F1 Goals:** create a goal → milestones → weekly commitments
- [ ] **Waitlist page live (target: Wed Aug 5)** — email → Supabase

### Week 2 (Aug 8–14) — the daily loop
- [ ] **F2 Today screen** — derive today's ONE action from weekly commitments
- [ ] **F3 Daily check-in** — note + tick commitments, under 60s
- [ ] **F5 Scoring** — points per day, running weekly total
- [ ] History view (past check-ins)
- [ ] **F6 Goal repetition** — goal visible on every screen
- [ ] Deploy. Invite the first waitlist emails.

### Week 3 (Aug 15–21) — drift detection + evals
- [ ] Groq client + provider-agnostic model layer
- [ ] Structured output with Zod (verdict + gap + pace math), retries, rate-limit backoff
- [ ] **F4 Drift detection** — the core feature
- [ ] Pace math: required rate vs. actual rate vs. days remaining
- [ ] **EVAL HARNESS** ⭐ — golden set built from the builder's real June/July history.
      Does the AI's verdict match what actually happened? Regression run; a score drop fails the build.
- [ ] **Never cut the eval suite.** It is the single highest-value artifact in the project.

### Week 4 (Aug 22–31) — review, floor, launch
- [ ] **F7 Weekly review** — auto Sunday summary
- [ ] **F8 The floor** — define it, hitting it counts
- [ ] Free-tier limits (protects the Groq 30 req/min ceiling)
- [ ] PWA manifest, mobile polish, add-to-home-screen
- [ ] Bug bash from waitlist feedback
- [ ] **PUBLIC BETA — Fri Aug 28**

### September — make it real
Streaming responses · better drift prompts from real usage · first 20 real users ·
**tone calibration** (strict without being discouraging — the hardest product problem here)

### October — proof
Publish the **eval methodology write-up** (top marketing + resume asset) · paid tier only if
users ask · end-of-month review, decide 2027 from data

---

## 8. Definition of done (v1 ships when ALL are true)

1. Create a goal → milestones → weekly commitments
2. Today screen shows ONE pre-decided action
3. Daily check-in completes in under 60 seconds
4. AI returns an honest drift verdict with real pace math
5. Weekly review generates automatically
6. Floor can be defined, and hitting it counts as a real day
7. Eval suite runs against real history and reports a score
8. Deployed and PWA-installable
9. 20+ real users

## 9. Success metrics (by Oct 31 2026)

| Metric | Target |
|---|---|
| Real users | 20+ |
| Eval suite published + write-up | yes |
| Revenue | anything above $0 is a win, not the goal |

**Primary objective is the resume and the skills, not revenue.** Competitors exist
(NOZERO, Fostera, Commit, Accountability Buddie, Forfeit). The differentiator is not features —
it's a real documented failure story and 90 days of building it in public.

## 10. Working rules

- Content comes **out of** the build, never as a separate task.
- Bad-day floor: **1 post + 1 tiny commit.** Hitting the floor is not failure.
- If a deadline is at risk: **cut scope, not the date.** The eval suite is exempt.
- Anything not in §4 goes to `v2-ideas.md`.
