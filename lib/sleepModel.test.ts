import { describe, it, expect } from 'vitest'
import {
  recencyWeight,
  clipOutliersIQR,
  weightedMean,
  weightedStdDev,
  wakeWindowObservations,
  personalizedWindow,
  predictNextSleep,
  computeInsights,
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
