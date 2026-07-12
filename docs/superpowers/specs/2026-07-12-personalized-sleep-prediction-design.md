# Personalized Sleep Prediction Engine — Design

## Problem

`lib/sleepModel.ts` currently predicts a baby's next sleep time using a static, age-bracket lookup table (`wakeWindow(ageMonths)`). It ignores the baby's own logged history entirely — two babies of the same age get identical predictions regardless of their actual patterns. The tracker page also only fetches the last 36 hours of sessions, which isn't enough history for any learning-based approach.

## Goal

Replace the static prediction with a model that learns from the baby's own sleep history: personalized wake windows, a confidence signal, and trend/anomaly insights — while keeping the change self-contained (no new dependencies, tables, or cron jobs) and fitting the app's real data scale (one baby, a handful of sessions/day).

## Non-goals

- No external LLM calls / AI SDK integration. "AI" here means a personalized statistical model, not generative text.
- No server-side precomputation or caching layer (data volume is small enough that on-demand computation is effectively free).
- No changes to `dailyStats` or the History page.

## Design

### 1. Personalized wake-window model

New logic added to `lib/sleepModel.ts`:

- **Observations:** for each completed sleep session (excluding the currently open one), derive the "wake window" — minutes between the prior session's `ended_at` and this session's `started_at`.
- **Window:** consider observations from the last 30 days.
- **Outlier clipping:** clip observations outside the IQR (1.5× IQR fences) before weighting, so one bad log entry doesn't skew the model.
- **Recency weighting:** apply exponential decay with a 5-day half-life — `weight = 0.5^(ageInDays / 5)` — so recent patterns dominate but older data still contributes.
- **Personalized window:** compute the weighted mean and weighted stddev of the clipped observations. Personalized `{minMin, maxMin} = mean ∓ 0.75·stddev`, clamped to a sane floor/ceiling (never below 20 min, never above 8 hours).
- **Cold start blending:** if there are fewer than 8 valid (post-clip) observations, linearly blend the personalized mean with the existing age-based bracket midpoint: `blended = ageBasedMidpoint * (1 - n/8) + personalizedMean * (n/8)`. With 0 observations this is pure age-based (today's behavior); by 8+ it's fully personalized.
- **Confidence:** `'low'` (<4 obs), `'medium'` (4–11 obs), `'high'` (12+ obs), each also downgraded one level if weighted stddev is unusually high relative to the mean (coefficient of variation > 0.5), signaling an erratic pattern rather than a stable one.

`predictNextSleep()` keeps its existing signature and return shape (`nextSleepAt`, `wakeWindow`, `status`, `lastWakeAt`) — it internally calls the new personalized-window logic instead of the static `wakeWindow()` table. Existing callers (`AwakeCard`, the wake-window chip) need no changes; they'll just render smarter numbers. The `wakeWindow(ageMonths)` function stays as-is, now used only as the cold-start prior and the fallback when a baby has zero history.

### 2. Insights (trend + anomaly detection)

New function `computeInsights(sessions, birthDate, now): Insight[]` in `lib/sleepModel.ts`:

```ts
interface Insight {
  text: string
  severity: 'info' | 'notable'
}
```

Only runs when confidence is `'medium'` or `'high'` (i.e., enough data to say something meaningful). Checks, in priority order:

1. **Trend:** compare the weighted-mean wake window over the last 7 days vs. the prior 7–14-day period. If the shift is >15 min AND >20% relative, emit `"Wake windows have been stretching this week"` (or "shortening").
2. **Anomaly:** if the most recent *completed* wake-window observation is >1.5σ from the personalized mean, emit `"That was a short one — Xmin under the usual"` (or "long one — over").
3. **Nap-count deviation:** compare today's nap count so far (as of `now`) against the typical nap count logged by this time of day over the last 14 days (same weekday-agnostic average). If today is notably behind or ahead, emit `"Fewer naps than usual today so far"` (or "more").

Returns insights ranked by severity then recency-relevance; callers use only the top one for now.

### 3. UI changes (`components/TrackerClient.tsx`)

- **Fetch window:** change the session fetch range from the last 36 hours to the last 30 days. This is the only fetch on the tracker page; the extra payload is small (a few hundred rows at most for any realistic usage) and needed for both prediction and insights.
- **New `InsightCard` component**, defined inline alongside the existing `SleepingCard`/`AwakeCard` in `TrackerClient.tsx` (matching the file's current pattern of colocated card components). Rendered below the awake/sleeping card, in both sleeping and awake states, since insights are about the baby's overall pattern, not just the current status.
  - Shows nothing if `computeInsights` returns an empty array (no qualifying insight, e.g. cold start).
  - Shows the single top-ranked insight's `text` when present, styled distinctly by `severity` (`notable` gets slightly more visual weight, matching the existing orange/sage accent usage elsewhere in the file).

### 4. Testing

- Unit tests for the new `lib/sleepModel.ts` logic (weighted mean/stddev, IQR clipping, cold-start blending, confidence tiers, trend/anomaly/nap-count insight triggers) using constructed `SleepSession[]` fixtures — no test framework currently exists in this repo (`package.json` has no test script), so this requires adding one (Vitest is the natural fit for a Next.js/TS project with no existing test infra) as part of implementation.
- Manual verification: run the app locally, seed sessions across varied patterns (consistent, sparse/cold-start, trending, anomalous single nap) and confirm the predicted window and insight text behave as designed at each stage.

## Files touched

- `lib/sleepModel.ts` — add weighted-window model, cold-start blending, confidence, `computeInsights`.
- `components/TrackerClient.tsx` — widen fetch window to 30 days; add `InsightCard`.
- New: a test file for `lib/sleepModel.ts` (exact path decided during implementation planning, alongside adding Vitest to the project).
