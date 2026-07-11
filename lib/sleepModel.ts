import type { SleepSession } from '@/types'

const MS_PER_MIN = 60_000

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
  const window = wakeWindow(ageInMonths(birthDate, now))

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
