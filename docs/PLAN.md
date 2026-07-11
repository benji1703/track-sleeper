# track-sleeper — Implementation Plan

Baby sleep tracker. Web, mobile-first (iPhone 16 Pro / Safari). Vercel + Supabase + Google login.
Backend patterns copied from `../mili-rsvp` (Next.js 14 App Router, NextAuth v4 Google, Supabase service-role client).

## Stack
- Next.js 14.2 App Router, TypeScript, Tailwind CSS v3
- `@supabase/supabase-js` — service-role client server-side only (`lib/supabase.ts`)
- NextAuth v4, Google provider (`lib/auth.ts`), session strategy JWT
- Vercel deployment

## Database (Supabase / Postgres)
```sql
babies:          id uuid pk, owner_email text not null, name text not null,
                 birth_date date not null, created_at timestamptz default now()
sleep_sessions:  id uuid pk, baby_id uuid fk -> babies on delete cascade,
                 started_at timestamptz not null, ended_at timestamptz null,
                 type text check (type in ('nap','night')) default 'nap',
                 notes text, created_at timestamptz default now()
```
- `ended_at IS NULL` ⇒ currently sleeping.
- Index: `(baby_id, started_at desc)`.
- All access via service-role key; scoping enforced in API by `owner_email = session.user.email`.
- Migration file: `supabase/migrations/001_init.sql`.

## Sleep prediction model (`lib/sleepModel.ts`)
Deterministic wake-window model by age (months, from `birth_date`):
| Age | Wake window | Naps/day |
|---|---|---|
| 0–3mo | 60–90 min | 4–5 |
| 3–6mo | 1.5–2.5 h | 3–4 |
| 6–9mo | 2–3 h | 2–3 |
| 9–12mo | 2.5–3.5 h | 2 |
| 12–18mo | 3–4 h | 1–2 |
| 18mo+ | 4–6 h | 1 |

`predictNextSleep(sessions, birthDate, now)` → `{ nextSleepAt, wakeWindowMin, wakeWindowMax, status: 'sleeping'|'awake-ok'|'tired-soon'|'overtired' }` from last `ended_at` + midpoint of window. Also `dailyStats(sessions, day)` → total sleep, nap count, longest stretch.

## API routes (all check `getServerSession(authOptions)`; 401 otherwise)
- `GET/PUT /api/baby` — fetch/upsert baby for owner_email (single baby per account)
- `GET /api/sessions?from=ISO&to=ISO` — list sessions in range (default: last 14 days)
- `POST /api/sessions` — `{action:'start', type}` starts (rejects if one open); `{action:'stop'}` closes open session; `{action:'manual', started_at, ended_at, type}` adds past entry
- `PATCH/DELETE /api/sessions/[id]` — edit times/type/notes, delete (ownership checked via baby join)

## Pages
- `app/login/page.tsx` — Google button, brand mark
- `app/page.tsx` (server) + `components/TrackerClient.tsx` — big start/stop control with live elapsed timer, prediction card, today's timeline strip
- `app/history/page.tsx` + client — last 7/14 days: horizontal 24h bars per day, totals, averages
- `app/settings/page.tsx` — baby name, birth date, sign-out
- `middleware.ts` — NextAuth-protect all pages except `/login` and `/api/auth`
- First login with no baby → inline onboarding (name + birthdate) on `/`

## Design system — "Hermès minimal"
- Colors (tailwind.config.ts): `orange #F37021`, `cream #FAF6F0`, `ink #1A1A1A`, `sand #E8E0D5`, `sage #9CA88E`
- Type: serif display (Playfair Display or Georgia stack) for headings/numerals, system sans for body
- Hairline borders (`border-[0.5px] border-ink/15`), `rounded-2xl` cards, flat — no heavy shadows
- iPhone 16 Pro Safari: `viewport-fit=cover`, `env(safe-area-inset-*)` padding, `100dvh`, tap targets ≥44px, `-webkit-tap-highlight-color: transparent`, apple-web-app meta (standalone), theme-color cream
- Bottom nav: Track / History / Settings

## Env vars (`.env.local.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Execution phases
1. **executor (sonnet)** — scaffold: package.json, configs, tailwind, layout, lib/{supabase,auth,sleepModel,format}.ts, types, SQL migration, middleware, .env example, SETUP.md
2. **executor (sonnet)** — API routes + auth route
3. **designer (sonnet)** — pages + components, Hermès design, iPhone-first
4. **Fable (main)** — `npm run build`, code review, model sanity checks, fix, commit
5. User: create Supabase project, Google OAuth creds, `vercel` link + env, deploy

## Changelog
- Baby sharing (caregivers): `baby_caregivers` table (`supabase/migrations/002_caregivers.sql`),
  `lib/babyAccess.ts` (`getBabyForEmail`) resolves owner-or-caregiver access; all baby/session
  API routes use it. New `POST/DELETE /api/baby/share` manage caregivers by email (owner only).
  Retro-start: `POST /api/sessions {action:'start', started_at}` allows starting a session up to
  24h in the past, with an overlap guard against existing closed sessions. Added
  `lib/sleepInfo.ts` — evidence-based sleep guidance by age (wake windows, naps, sourced from
  AASM/NSF/AAP/NHS).
