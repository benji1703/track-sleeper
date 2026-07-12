import type { SleepSession } from '@/types'

const MS_PER_MIN = 60_000

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

export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(birthDate)
  const msDiff = now.getTime() - birth.getTime()
  const daysDiff = msDiff / (1000 * 60 * 60 * 24)
  return daysDiff / 30.4375
}

export interface WakeWindow {
  minMin: number
  maxMin: number
}

// Wake windows by age, in minutes.
export function wakeWindow(ageMonths: number): WakeWindow {
  if (ageMonths < 3) return { minMin: 60, maxMin: 90 }
  // 3-month wake window per Huckleberry's age guide (huckleberrycare.com/age-guides/3-months).
  if (ageMonths < 4) return { minMin: 60, maxMin: 120 }
  if (ageMonths < 6) return { minMin: 90, maxMin: 150 }
  if (ageMonths < 9) return { minMin: 120, maxMin: 180 }
  if (ageMonths < 12) return { minMin: 150, maxMin: 210 }
  if (ageMonths < 18) return { minMin: 180, maxMin: 240 }
  return { minMin: 240, maxMin: 360 }
}

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

export type SleepStatus = 'sleeping' | 'awake-ok' | 'tired-soon' | 'overtired'

export interface SleepPrediction {
  nextSleepAt: Date | null
  wakeWindow: WakeWindow
  status: SleepStatus
  lastWakeAt: Date | null
}

export function predictNextSleep(
  sessions: SleepSession[],
  birthDate: string,
  now: Date = new Date()
): SleepPrediction {
  const window = personalizedWindow(sessions, birthDate, now).window

  const openSession = sessions.find((s) => s.ended_at === null)
  if (openSession) {
    return {
      nextSleepAt: null,
      wakeWindow: window,
      status: 'sleeping',
      lastWakeAt: null,
    }
  }

  const latest = sessions
    .filter((s) => s.ended_at !== null)
    .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())[0]

  if (!latest) {
    return {
      nextSleepAt: null,
      wakeWindow: window,
      status: 'awake-ok',
      lastWakeAt: null,
    }
  }

  const lastWakeAt = new Date(latest.ended_at!)
  const midpointMin = (window.minMin + window.maxMin) / 2
  const nextSleepAt = new Date(lastWakeAt.getTime() + midpointMin * MS_PER_MIN)

  const minutesAwake = (now.getTime() - lastWakeAt.getTime()) / MS_PER_MIN

  let status: SleepStatus = 'awake-ok'
  if (minutesAwake >= window.maxMin) {
    status = 'overtired'
  } else if (minutesAwake >= window.minMin) {
    status = 'tired-soon'
  }

  return { nextSleepAt, wakeWindow: window, status, lastWakeAt }
}

export interface DailyStats {
  totalMin: number
  napCount: number
  nightMin: number
  longestMin: number
}

export function dailyStats(
  sessions: SleepSession[],
  dayISO: string,
  tz: string = 'Asia/Jerusalem'
): DailyStats {
  const { dayStart, dayEnd } = dayBoundsInTz(dayISO, tz)
  const now = new Date()

  let totalMin = 0
  let napCount = 0
  let nightMin = 0
  let longestMin = 0

  for (const session of sessions) {
    const start = new Date(session.started_at)
    const end = session.ended_at ? new Date(session.ended_at) : now

    const clippedStart = start < dayStart ? dayStart : start
    const clippedEnd = end > dayEnd ? dayEnd : end

    if (clippedEnd <= clippedStart) continue

    const durationMin = (clippedEnd.getTime() - clippedStart.getTime()) / MS_PER_MIN
    totalMin += durationMin
    longestMin = Math.max(longestMin, durationMin)

    if (session.type === 'night') {
      nightMin += durationMin
    } else {
      napCount += 1
    }
  }

  return { totalMin, napCount, nightMin, longestMin }
}

function dayBoundsInTz(dayISO: string, tz: string): { dayStart: Date; dayEnd: Date } {
  // dayISO is a 'YYYY-MM-DD' calendar date. Find the UTC instants that correspond
  // to midnight at the start and end of that date in the given timezone.
  const [year, month, day] = dayISO.split('-').map(Number)

  const offsetMin = tzOffsetMinutes(dayISO, tz)
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMin * MS_PER_MIN)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MS_PER_MIN)

  return { dayStart, dayEnd }
}

// Offset (in minutes) to add to local wall-clock time to get UTC, for the given date/tz.
function tzOffsetMinutes(dayISO: string, tz: string): number {
  const [year, month, day] = dayISO.split('-').map(Number)
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcGuess)

  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = Number(part.value)
  }

  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second
  )

  return (asUTC - utcGuess.getTime()) / MS_PER_MIN
}
