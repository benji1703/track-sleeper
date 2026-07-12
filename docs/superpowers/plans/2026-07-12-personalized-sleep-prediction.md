# Personalized Sleep Prediction Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static age-bracket wake-window lookup in `lib/sleepModel.ts` with a model learned from each baby's own logged sleep history, and surface trend/anomaly insights on the tracker page.

**Architecture:** Pure-function statistics helpers (recency-weighted mean/stddev, IQR outlier clipping) feed a `personalizedWindow()` function that blends the baby's own wake-window observations with the existing age-based table as a cold-start prior. `predictNextSleep()` is rewired internally to use this instead of the static table, keeping its external signature unchanged. A new `computeInsights()` function derives trend/anomaly/nap-count insights from the same observations, gated by a confidence score. `TrackerClient.tsx` widens its session fetch from 36h to 30 days and renders the single top insight in a new card.

**Tech Stack:** Next.js 14 (App Router), TypeScript (strict), React 18, Vitest (new — no test framework currently exists in this repo).

## Global Constraints

- No new runtime dependencies beyond Vitest (dev dependency only) — spec requires "no new dependencies" for the model itself; Vitest is test-only tooling.
- No new Supabase tables, migrations, or cron jobs.
- `predictNextSleep()` keeps its existing signature and return shape (`{ nextSleepAt, wakeWindow, status, lastWakeAt }`) — existing callers (`AwakeCard`) require no changes.
- `wakeWindow(ageMonths)` (the static age-based table) stays exported and unchanged — it becomes the cold-start prior / zero-data fallback.
- All new logic lives in `lib/sleepModel.ts` (extending, not replacing, the existing file) except the UI card, which lives in `components/TrackerClient.tsx` alongside the other card components.
- Personalized model window: last 30 days of sessions, IQR-clipped, exponential recency decay with a 5-day half-life.
- Cold-start blend threshold: fewer than 8 valid (post-clip) observations blends personalized mean with age-based midpoint.
- Confidence tiers: `'low'` (<4 obs), `'medium'` (4–11 obs), `'high'` (12+ obs), downgraded one level if coefficient of variation (stddev/mean) > 0.5.
- Insights only computed when confidence is `'medium'` or `'high'`.
- Insight trigger thresholds: trend shift >15 min AND >20% relative (week vs. prior week); anomaly >1.5σ from personalized mean; nap-count deviation vs. 14-day same-time-of-day average.
- Timezone: reuse the existing `'Asia/Jerusalem'` default and day-boundary math already private to `lib/sleepModel.ts` (`dayBoundsInTz`/`tzOffsetMinutes`) — do not duplicate or import tz logic from `components/timeUtils.ts` (wrong layering: lib must not depend on components).

---

### Task 1: Add Vitest and core weighted-statistics helpers

**Files:**
- Modify: `package.json` (add Vitest dev dependency + `test` script)
- Create: `vitest.config.ts`
- Modify: `lib/sleepModel.ts` (add helpers, non-exported except where noted)
- Test: `lib/sleepModel.test.ts`

**Interfaces:**
- Consumes: nothing (foundational task)
- Produces (used by Task 2 and Task 3):
  - `export function recencyWeight(ageDays: number, halfLifeDays?: number): number` — `halfLifeDays` defaults to `5`. Returns `0.5 ** (ageDays / halfLifeDays)`.
  - `export function clipOutliersIQR(values: number[]): number[]` — returns the subset of `values` within `[Q1 - 1.5*IQR, Q3 + 1.5*IQR]`. For `values.length < 4`, returns `values` unchanged (not enough data to compute quartiles meaningfully).
  - `export interface WeightedObservation { value: number; weight: number }`
  - `export function weightedMean(obs: WeightedObservation[]): number` — returns `0` for an empty array.
  - `export function weightedStdDev(obs: WeightedObservation[], mean: number): number` — population-weighted stddev; returns `0` for an empty array or single observation.

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: Add test script to package.json**

Modify `package.json` scripts block:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Write the failing tests**

Create `lib/sleepModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { recencyWeight, clipOutliersIQR, weightedMean, weightedStdDev } from './sleepModel'

describe('recencyWeight', () => {
  it('returns 1 for age 0', () => {
    expect(recencyWeight(0)).toBe(1)
  })

  it('returns 0.5 at the half-life', () => {
    expect(recencyWeight(5, 5)).toBeCloseTo(0.5, 5)
  })

  it('decays toward 0 for old observations', () => {
    expect(recencyWeight(50, 5)).toBeLessThan(0.01)
  })
})

describe('clipOutliersIQR', () => {
  it('removes values far outside the interquartile range', () => {
    const values = [60, 65, 70, 68, 62, 500]
    const clipped = clipOutliersIQR(values)
    expect(clipped).not.toContain(500)
    expect(clipped).toEqual(expect.arrayContaining([60, 65, 70, 68, 62]))
  })

  it('returns input unchanged when fewer than 4 values', () => {
    const values = [10, 500, 20]
    expect(clipOutliersIQR(values)).toEqual(values)
  })
})

describe('weightedMean', () => {
  it('returns 0 for an empty array', () => {
    expect(weightedMean([])).toBe(0)
  })

  it('weights higher-weight observations more heavily', () => {
    const mean = weightedMean([
      { value: 100, weight: 1 },
      { value: 200, weight: 3 },
    ])
    expect(mean).toBeCloseTo(175, 5)
  })
})

describe('weightedStdDev', () => {
  it('returns 0 for an empty array', () => {
    expect(weightedStdDev([], 0)).toBe(0)
  })

  it('returns 0 for a single observation', () => {
    expect(weightedStdDev([{ value: 100, weight: 1 }], 100)).toBe(0)
  })

  it('computes a positive spread for varied observations', () => {
    const obs = [
      { value: 60, weight: 1 },
      { value: 90, weight: 1 },
      { value: 120, weight: 1 },
    ]
    const mean = weightedMean(obs)
    expect(weightedStdDev(obs, mean)).toBeCloseTo(24.49, 1)
  })
})
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `recencyWeight`, `clipOutliersIQR`, `weightedMean`, `weightedStdDev` are not exported from `./sleepModel`.

- [ ] **Step 6: Implement the helpers**

Add to `lib/sleepModel.ts` (near the top, after the `MS_PER_MIN` constant):

```ts
export function recencyWeight(ageDays: number, halfLifeDays: number = 5): number {
  return Math.pow(0.5, ageDays / halfLifeDays)
}

export function clipOutliersIQR(values: number[]): number[] {
  if (values.length < 4) return values

  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr

  return values.filter((v) => v >= lower && v <= upper)
}

function quantile(sortedValues: number[], q: number): number {
  const pos = (sortedValues.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sortedValues[base + 1] !== undefined) {
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base])
  }
  return sortedValues[base]
}

export interface WeightedObservation {
  value: number
  weight: number
}

export function weightedMean(obs: WeightedObservation[]): number {
  if (obs.length === 0) return 0
  const weightSum = obs.reduce((sum, o) => sum + o.weight, 0)
  if (weightSum === 0) return 0
  return obs.reduce((sum, o) => sum + o.value * o.weight, 0) / weightSum
}

export function weightedStdDev(obs: WeightedObservation[], mean: number): number {
  if (obs.length < 2) return 0
  const weightSum = obs.reduce((sum, o) => sum + o.weight, 0)
  if (weightSum === 0) return 0
  const variance = obs.reduce((sum, o) => sum + o.weight * (o.value - mean) ** 2, 0) / weightSum
  return Math.sqrt(variance)
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `lib/sleepModel.test.ts` green.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/sleepModel.ts lib/sleepModel.test.ts
git commit -m "test: add Vitest and weighted-statistics helpers for sleep prediction"
```

---

### Task 2: Personalized wake-window model with cold-start blending and confidence

**Files:**
- Modify: `lib/sleepModel.ts`
- Test: `lib/sleepModel.test.ts`

**Interfaces:**
- Consumes: `recencyWeight`, `clipOutliersIQR`, `weightedMean`, `weightedStdDev`, `WeightedObservation` (Task 1); existing `wakeWindow(ageMonths)`, `ageInMonths(birthDate, now)`, `WakeWindow` (already in file).
- Produces (used by Task 3 and Task 4):
  - `export type Confidence = 'low' | 'medium' | 'high'`
  - `export interface WakeWindowObservation { minutesAwake: number; observedAt: Date }`
  - `export function wakeWindowObservations(sessions: SleepSession[], now: Date): WakeWindowObservation[]` — for each pair of chronologically consecutive *completed* sessions (sorted by `started_at` ascending, current open session excluded), computes `minutesAwake = (next.started_at - prev.ended_at) / MS_PER_MIN`. Skips pairs where the gap is negative or exceeds 24h (missed-logging sanity cap). `observedAt` is `next.started_at`. Only includes observations where `observedAt` is within the last 30 days of `now`.
  - `export interface PersonalizedWindow { window: WakeWindow; confidence: Confidence; sampleCount: number; observations: WakeWindowObservation[] }`
  - `export function personalizedWindow(sessions: SleepSession[], birthDate: string, now: Date): PersonalizedWindow`
- `predictNextSleep()` (existing, in this file) is modified internally to call `personalizedWindow()` instead of `wakeWindow(ageInMonths(...))` directly, but its exported signature and `SleepPrediction` return type are unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `lib/sleepModel.test.ts`:

```ts
import {
  wakeWindowObservations,
  personalizedWindow,
  predictNextSleep,
} from './sleepModel'
import type { SleepSession } from '@/types'

function session(id: string, startedAt: string, endedAt: string | null, type: 'nap' | 'night' = 'nap'): SleepSession {
  return { id, baby_id: 'baby-1', started_at: startedAt, ended_at: endedAt, type, notes: null, created_at: startedAt }
}

// Builds `n` sessions as a single chronological chain, each 30min long,
// with an exact `gapMinutes` wake window before the next, ending at
// `endingAt`. Produces exactly n-1 clean wake-window observations — no
// separate synthetic "wake" sessions, so consecutive-session pairing in
// wakeWindowObservations can't pick up unintended extra gaps.
function buildChain(n: number, gapMinutes: number, endingAt: Date): SleepSession[] {
  const sessionDurationMs = 30 * 60 * 1000
  const chain: SleepSession[] = []
  let cursor = endingAt.getTime()
  for (let i = 0; i < n; i++) {
    const endedAt = new Date(cursor)
    const startedAt = new Date(cursor - sessionDurationMs)
    chain.unshift(session(`chain-${endingAt.getTime()}-${i}`, startedAt.toISOString(), endedAt.toISOString()))
    cursor = startedAt.getTime() - gapMinutes * 60 * 1000
  }
  return chain
}

describe('wakeWindowObservations', () => {
  it('derives minutes-awake between consecutive completed sessions', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const sessions = [
      session('1', '2026-07-10T08:00:00Z', '2026-07-10T09:00:00Z'), // wakes at 09:00
      session('2', '2026-07-10T11:00:00Z', '2026-07-10T12:00:00Z'), // starts 2h later
    ]
    const obs = wakeWindowObservations(sessions, now)
    expect(obs).toHaveLength(1)
    expect(obs[0].minutesAwake).toBeCloseTo(120, 5)
  })

  it('excludes the currently open session and gaps over 24h', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const sessions = [
      session('1', '2026-07-01T08:00:00Z', '2026-07-01T09:00:00Z'),
      session('2', '2026-07-05T09:00:00Z', '2026-07-05T10:00:00Z'), // 4-day gap, excluded
      session('3', '2026-07-12T10:00:00Z', null), // open session
    ]
    const obs = wakeWindowObservations(sessions, now)
    expect(obs).toHaveLength(0)
  })

  it('excludes observations older than 30 days', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const sessions = [
      session('1', '2026-05-01T08:00:00Z', '2026-05-01T09:00:00Z'),
      session('2', '2026-05-01T11:00:00Z', '2026-05-01T12:00:00Z'),
    ]
    expect(wakeWindowObservations(sessions, now)).toHaveLength(0)
  })
})

describe('personalizedWindow', () => {
  it('falls back to the age-based window with zero observations (low confidence)', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const birthDate = '2026-04-01' // ~3.4 months old, safely inside the 3-4 month bracket
    const result = personalizedWindow([], birthDate, now)
    expect(result.confidence).toBe('low')
    expect(result.sampleCount).toBe(0)
    expect(result.window).toEqual({ minMin: 60, maxMin: 120 })
  })

  it('reaches high confidence with 12+ consistent observations', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const birthDate = '2026-01-12' // 6 months old
    const sessions = buildChain(13, 120, now) // 12 observations of ~120min, ending now
    const result = personalizedWindow(sessions, birthDate, now)
    expect(result.confidence).toBe('high')
    expect(result.window.minMin).toBeLessThan(150)
    expect(result.window.maxMin).toBeGreaterThan(90)
  })
})

describe('predictNextSleep with personalized data', () => {
  it('keeps the same return shape', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const sessions = [session('1', '2026-07-12T08:00:00Z', '2026-07-12T09:00:00Z')]
    const result = predictNextSleep(sessions, '2026-04-12', now)
    expect(result).toHaveProperty('nextSleepAt')
    expect(result).toHaveProperty('wakeWindow')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('lastWakeAt')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `wakeWindowObservations` and `personalizedWindow` are not exported.

- [ ] **Step 3: Implement wakeWindowObservations and personalizedWindow**

Add to `lib/sleepModel.ts`, above `predictNextSleep`:

```ts
export type Confidence = 'low' | 'medium' | 'high'

export interface WakeWindowObservation {
  minutesAwake: number
  observedAt: Date
}

const OBSERVATION_WINDOW_DAYS = 30
const MAX_GAP_HOURS = 24
const COLD_START_THRESHOLD = 8
const MIN_WINDOW_MIN = 20
const MAX_WINDOW_MIN = 480

export function wakeWindowObservations(sessions: SleepSession[], now: Date): WakeWindowObservation[] {
  const completed = sessions
    .filter((s) => s.ended_at !== null)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  const cutoff = now.getTime() - OBSERVATION_WINDOW_DAYS * 24 * 60 * MS_PER_MIN

  const observations: WakeWindowObservation[] = []
  for (let i = 1; i < completed.length; i++) {
    const prevEnd = new Date(completed[i - 1].ended_at!).getTime()
    const nextStart = new Date(completed[i].started_at).getTime()
    const minutesAwake = (nextStart - prevEnd) / MS_PER_MIN

    if (minutesAwake < 0 || minutesAwake > MAX_GAP_HOURS * 60) continue
    if (nextStart < cutoff) continue

    observations.push({ minutesAwake, observedAt: new Date(nextStart) })
  }

  return observations
}

export interface PersonalizedWindow {
  window: WakeWindow
  confidence: Confidence
  sampleCount: number
  observations: WakeWindowObservation[]
}

export function personalizedWindow(
  sessions: SleepSession[],
  birthDate: string,
  now: Date
): PersonalizedWindow {
  const ageWindow = wakeWindow(ageInMonths(birthDate, now))
  const ageMidpoint = (ageWindow.minMin + ageWindow.maxMin) / 2
  const ageHalfWidth = (ageWindow.maxMin - ageWindow.minMin) / 2

  const rawObservations = wakeWindowObservations(sessions, now)
  const clippedValues = clipOutliersIQR(rawObservations.map((o) => o.minutesAwake))
  const clipped = rawObservations.filter((o) => clippedValues.includes(o.minutesAwake))

  const weighted: WeightedObservation[] = clipped.map((o) => ({
    value: o.minutesAwake,
    weight: recencyWeight((now.getTime() - o.observedAt.getTime()) / (24 * 60 * MS_PER_MIN)),
  }))

  const n = clipped.length
  const personalizedMean = weightedMean(weighted)
  const personalizedStdDev = weightedStdDev(weighted, personalizedMean)
  const personalizedHalfWidth = 0.75 * personalizedStdDev

  const blend = Math.min(n / COLD_START_THRESHOLD, 1)
  const blendedMean = n === 0 ? ageMidpoint : ageMidpoint * (1 - blend) + personalizedMean * blend
  const blendedHalfWidth = n === 0 ? ageHalfWidth : ageHalfWidth * (1 - blend) + personalizedHalfWidth * blend

  const minMin = Math.max(MIN_WINDOW_MIN, blendedMean - blendedHalfWidth)
  const maxMin = Math.min(MAX_WINDOW_MIN, Math.max(minMin + 1, blendedMean + blendedHalfWidth))

  let confidence: Confidence = n < 4 ? 'low' : n < 12 ? 'medium' : 'high'
  const cv = personalizedMean > 0 ? personalizedStdDev / personalizedMean : 0
  if (cv > 0.5 && confidence !== 'low') {
    confidence = confidence === 'high' ? 'medium' : 'low'
  }

  return {
    window: { minMin, maxMin },
    confidence,
    sampleCount: n,
    observations: clipped,
  }
}
```

- [ ] **Step 4: Rewire predictNextSleep to use personalizedWindow**

In `lib/sleepModel.ts`, inside `predictNextSleep`, replace:

```ts
  const window = wakeWindow(ageInMonths(birthDate, now))
```

with:

```ts
  const window = personalizedWindow(sessions, birthDate, now).window
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `lib/sleepModel.test.ts` green, including the new `wakeWindowObservations`, `personalizedWindow`, and `predictNextSleep` suites.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/sleepModel.ts lib/sleepModel.test.ts
git commit -m "feat: personalized wake-window model with cold-start blending"
```

---

### Task 3: Trend, anomaly, and nap-count insights

**Files:**
- Modify: `lib/sleepModel.ts`
- Test: `lib/sleepModel.test.ts`

**Interfaces:**
- Consumes: `personalizedWindow`, `wakeWindowObservations`, `WakeWindowObservation`, `Confidence` (Task 2); `recencyWeight`, `weightedMean` (Task 1); existing private `dayBoundsInTz` (already in file, used by `dailyStats`); existing `dailyStats`, `dateISOInTz`-equivalent logic (see Step 3 note on reusing `dayBoundsInTz`).
- Produces (used by Task 4):
  - `export type InsightSeverity = 'info' | 'notable'`
  - `export interface Insight { text: string; severity: InsightSeverity }`
  - `export function computeInsights(sessions: SleepSession[], birthDate: string, now: Date, tz?: string): Insight[]` — `tz` defaults to `'Asia/Jerusalem'`.

- [ ] **Step 1: Write the failing tests**

Add to `lib/sleepModel.test.ts`:

```ts
import { computeInsights } from './sleepModel'

describe('computeInsights', () => {
  it('returns no insights below medium confidence', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const sessions = [session('1', '2026-07-12T08:00:00Z', '2026-07-12T09:00:00Z')]
    expect(computeInsights(sessions, '2026-04-12', now)).toEqual([])
  })

  it('flags a stretching trend', () => {
    const now = new Date('2026-07-12T12:00:00Z')

    // Prior segment: 7 gaps of 60min, ending ~7 days ago. Recent segment:
    // 7 gaps of 150min, ending now. The multi-day jump between segments
    // exceeds the 24h cutoff in wakeWindowObservations and is dropped
    // automatically, so the two segments can't contaminate each other.
    const priorEndingAt = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
    const recentEndingAt = now
    const sessions = [...buildChain(8, 60, priorEndingAt), ...buildChain(8, 150, recentEndingAt)]

    const insights = computeInsights(sessions, '2026-01-12', now)
    expect(insights.some((i) => i.text.toLowerCase().includes('stretch'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `computeInsights` is not exported.

- [ ] **Step 3: Implement computeInsights**

Add to `lib/sleepModel.ts`, after `personalizedWindow`. Reuse the file's existing private `dayBoundsInTz` (already defined lower in the file for `dailyStats`) — no new tz logic needed:

```ts
export type InsightSeverity = 'info' | 'notable'

export interface Insight {
  text: string
  severity: InsightSeverity
}

function weightedMeanOfRange(
  observations: WakeWindowObservation[],
  now: Date,
  startDaysAgo: number,
  endDaysAgo: number
): { mean: number; count: number } {
  const inRange = observations.filter((o) => {
    const ageDays = (now.getTime() - o.observedAt.getTime()) / (24 * 60 * MS_PER_MIN)
    return ageDays >= endDaysAgo && ageDays < startDaysAgo
  })
  const weighted: WeightedObservation[] = inRange.map((o) => ({
    value: o.minutesAwake,
    weight: recencyWeight((now.getTime() - o.observedAt.getTime()) / (24 * 60 * MS_PER_MIN)),
  }))
  return { mean: weightedMean(weighted), count: inRange.length }
}

function napsBeforeCutoff(sessions: SleepSession[], dayISO: string, tz: string, cutoff: Date): number {
  const { dayStart } = dayBoundsInTz(dayISO, tz)
  return sessions.filter((s) => {
    if (s.type !== 'nap') return false
    const start = new Date(s.started_at)
    return start >= dayStart && start < cutoff
  }).length
}

export function computeInsights(
  sessions: SleepSession[],
  birthDate: string,
  now: Date,
  tz: string = 'Asia/Jerusalem'
): Insight[] {
  const model = personalizedWindow(sessions, birthDate, now)
  if (model.confidence === 'low') return []

  const insights: Insight[] = []

  // 1. Trend: last 7 days vs. prior 7-14 days.
  const recent = weightedMeanOfRange(model.observations, now, 7, 0)
  const prior = weightedMeanOfRange(model.observations, now, 14, 7)
  if (recent.count > 0 && prior.count > 0 && prior.mean > 0) {
    const deltaMin = recent.mean - prior.mean
    const deltaPct = Math.abs(deltaMin) / prior.mean
    if (Math.abs(deltaMin) > 15 && deltaPct > 0.2) {
      insights.push({
        text: `Wake windows have been ${deltaMin > 0 ? 'stretching' : 'shortening'} this week`,
        severity: 'notable',
      })
    }
  }

  // 2. Anomaly: most recent observation vs. overall personalized mean.
  const sortedObs = [...model.observations].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())
  const latest = sortedObs[0]
  if (latest) {
    const weighted: WeightedObservation[] = model.observations.map((o) => ({
      value: o.minutesAwake,
      weight: recencyWeight((now.getTime() - o.observedAt.getTime()) / (24 * 60 * MS_PER_MIN)),
    }))
    const mean = weightedMean(weighted)
    const stddev = weightedStdDev(weighted, mean)
    if (stddev > 0) {
      const deviation = latest.minutesAwake - mean
      if (Math.abs(deviation) > 1.5 * stddev) {
        const diffMin = Math.round(Math.abs(deviation))
        insights.push({
          text:
            deviation < 0
              ? `That was a short one — ${diffMin}min under the usual`
              : `That was a long one — ${diffMin}min over the usual`,
          severity: 'notable',
        })
      }
    }
  }

  // 3. Nap-count deviation vs. same-time-of-day 14-day average.
  const todayISO = dateISOInTzLocal(now, tz)
  const todayCount = napsBeforeCutoff(sessions, todayISO, tz, now)
  const priorCounts: number[] = []
  for (let d = 1; d <= 14; d++) {
    const dayDate = new Date(now.getTime() - d * 24 * 3600 * 1000)
    const dayISO = dateISOInTzLocal(dayDate, tz)
    const { dayStart } = dayBoundsInTz(dayISO, tz)
    const cutoffSameTime = new Date(
      dayStart.getTime() + (now.getTime() - dayBoundsInTz(todayISO, tz).dayStart.getTime())
    )
    priorCounts.push(napsBeforeCutoff(sessions, dayISO, tz, cutoffSameTime))
  }
  const typicalCount = priorCounts.reduce((a, b) => a + b, 0) / priorCounts.length
  if (typicalCount >= 1 && Math.abs(todayCount - typicalCount) >= 1) {
    insights.push({
      text: todayCount < typicalCount ? 'Fewer naps than usual today so far' : 'More naps than usual today so far',
      severity: 'info',
    })
  }

  return insights.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'notable' ? -1 : 1))
}

function dateISOInTzLocal(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return `${map.year}-${map.month}-${map.day}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `lib/sleepModel.test.ts` green, including `computeInsights`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/sleepModel.ts lib/sleepModel.test.ts
git commit -m "feat: trend, anomaly, and nap-count insights from sleep history"
```

---

### Task 4: Wire personalized predictions and insights into the tracker page

**Files:**
- Modify: `components/TrackerClient.tsx`

**Interfaces:**
- Consumes: `computeInsights`, `Insight` (Task 3) from `@/lib/sleepModel`; existing `predictNextSleep`, `dailyStats`, `ageInMonths` (unchanged imports); existing `fmtDuration`/`fmtTime` from `@/lib/format`.
- Produces: nothing consumed by later tasks (final integration task).

- [ ] **Step 1: Widen the session fetch window from 36 hours to 30 days**

In `components/TrackerClient.tsx`, inside `load()` (around line 237-238), replace:

```ts
        const to = new Date()
        const from = new Date(to.getTime() - 36 * 3600 * 1000)
```

with:

```ts
        const to = new Date()
        const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000)
```

- [ ] **Step 2: Import computeInsights and Insight**

At the top of `components/TrackerClient.tsx`, update the existing import line:

```ts
import { predictNextSleep, dailyStats, ageInMonths } from '@/lib/sleepModel'
```

to:

```ts
import { predictNextSleep, dailyStats, ageInMonths, computeInsights, type Insight } from '@/lib/sleepModel'
```

- [ ] **Step 3: Compute insights alongside the existing prediction**

In the main render body of `TrackerClient`, immediately after the existing line (around line 440):

```ts
  const prediction = predictNextSleep(sessions, baby.birth_date, now)
```

add:

```ts
  const insights = computeInsights(sessions, baby.birth_date, now)
  const topInsight: Insight | undefined = insights[0]
```

- [ ] **Step 4: Add the InsightCard component**

Add a new component in `components/TrackerClient.tsx`, directly after `AwakeCard` (after its closing `}` around line 736):

```ts
function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-2xl border px-5 py-4 text-[13px] leading-relaxed',
        insight.severity === 'notable'
          ? 'border-orange/30 bg-orange/5 text-orange'
          : 'border-ink/15 bg-transparent text-ink/60'
      )}
    >
      <span>{insight.text}</span>
    </div>
  )
}
```

- [ ] **Step 5: Render InsightCard below the awake/sleeping card**

In the main JSX return of `TrackerClient` (around lines 458-483), after the closing of the `openSession ? <SleepingCard .../> : <AwakeCard .../>` block and before the `<section className="mt-10 ...">Today` section, add:

```tsx
      {topInsight && (
        <div className="mt-4">
          <InsightCard insight={topInsight} />
        </div>
      )}
```

So the surrounding structure reads:

```tsx
      {openSession ? (
        <SleepingCard ... />
      ) : (
        <AwakeCard ... />
      )}

      {topInsight && (
        <div className="mt-4">
          <InsightCard insight={topInsight} />
        </div>
      )}

      <section className="mt-10 flex flex-col gap-4">
        <p className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Today</p>
        ...
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: production build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add components/TrackerClient.tsx
git commit -m "feat: surface personalized predictions and insights on tracker page"
```

---

### Task 5: Manual verification across data stages

**Files:** none (verification only — no code changes)

**Interfaces:**
- Consumes: the running app (`npm run dev`), authenticated browser session, `POST /api/sessions` with `{ action: 'manual', started_at, ended_at, type }` (existing endpoint, unchanged).

This task confirms the model behaves correctly at each real-world stage: cold start, growing confidence, a trend, and an anomaly. Seed data via the browser console (already-authenticated session, so `fetch` carries the auth cookie automatically) rather than curl, since auth is Google/NextAuth-based.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`.

- [ ] **Step 2: Log in and confirm cold-start behavior**

In the browser, log in and land on the tracker page with a freshly onboarded baby (zero sessions). Confirm:
- The wake-window chip shows the exact static age-based range (matches `wakeWindow(ageMonths)` in `lib/sleepModel.ts` for that age).
- No `InsightCard` is rendered (confidence is `'low'` with 0 observations).

- [ ] **Step 3: Seed a consistent baseline to reach medium/high confidence**

In the browser dev console (while on the tracker page, authenticated), define a chain-seeding helper and use it to build a consistent baseline ending 8 days ago (so it lands in the "prior week" bucket used by trend detection later):

```js
// Seeds `n` sessions as a single chronological chain, each ended session
// exactly `gapMinutes` before the next one starts, ending at `endingAt`.
// This produces exactly n-1 wake-window observations of `gapMinutes` each —
// matches how lib/sleepModel.ts pairs consecutive completed sessions.
async function seedChain(n, gapMinutes, endingAt) {
  const sessionDurationMs = 30 * 60 * 1000
  let cursor = endingAt.getTime()
  const chain = []
  for (let i = 0; i < n; i++) {
    const endedAt = new Date(cursor)
    const startedAt = new Date(cursor - sessionDurationMs)
    chain.unshift({ startedAt, endedAt })
    cursor = startedAt.getTime() - gapMinutes * 60 * 1000
  }
  for (const s of chain) {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'manual',
        type: 'nap',
        started_at: s.startedAt.toISOString(),
        ended_at: s.endedAt.toISOString(),
      }),
    })
  }
}

const priorEndingAt = new Date(Date.now() - 8 * 24 * 3600 * 1000)
await seedChain(10, 90, priorEndingAt) // 9 observations of ~90min, ~8 days ago
```

Reload the page. Confirm:
- The wake-window chip now shows a range centered near 90 minutes (not the static age-based range), since the model has enough consistent observations (confidence should be `'medium'` or `'high'` — 9 observations).
- No `InsightCard` yet (only one data cluster exists, nothing to compare against or deviate from).

- [ ] **Step 4: Seed a recent, stretched-out chain and confirm a trend or anomaly insight appears**

```js
await seedChain(8, 180, new Date()) // 7 observations of ~180min, ending now
```

Reload the page. Confirm an `InsightCard` appears. Given the algorithm in Task 3 (trend compares last-7-days vs. prior-7-14-days mean; anomaly compares the single latest observation against the overall weighted mean/stddev), both conditions are legitimately satisfied by this data — a sharp, sudden shift is expected to trigger trend detection, anomaly detection, or both simultaneously. Confirm the displayed text is one of: `"Wake windows have been stretching this week"` or `"That was a long one — ...over the usual"`. Either (or both, with the `'notable'`-severity one shown first per the priority order in `computeInsights`) is correct behavior, not a bug.

- [ ] **Step 5: Clean up seeded data**

Delete the seeded sessions via the History page UI (or directly in Supabase) so the test baby's data doesn't pollute real usage. Confirm the History page's delete flow removes sessions correctly (existing functionality, unaffected by this change).

- [ ] **Step 6: Record verification result**

No commit for this task (verification only). If any step fails, return to the relevant task, fix, and re-run its automated tests before re-verifying manually.
