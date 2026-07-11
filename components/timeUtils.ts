// Small client-side time helpers shared by TrackerClient and HistoryClient.
// Mirrors the private day-boundary logic in lib/sleepModel.ts (not exported there),
// needed here to compute per-session clip positions for timeline strips.

export const TZ = 'Asia/Jerusalem'
export const MS_PER_MIN = 60_000
export const MS_PER_DAY = 24 * 60 * MS_PER_MIN

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

export function dayBoundsInTz(dayISO: string, tz: string = TZ): { dayStart: Date; dayEnd: Date } {
  const [year, month, day] = dayISO.split('-').map(Number)
  const offsetMin = tzOffsetMinutes(dayISO, tz)
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMin * MS_PER_MIN)
  const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY)
  return { dayStart, dayEnd }
}

export function dateISOInTz(date: Date, tz: string = TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function localHourInTz(date: Date, tz: string = TZ): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  })
    .formatToParts(date)
    .find((p) => p.type === 'hour')?.value
  return part ? Number(part) % 24 : date.getHours()
}
