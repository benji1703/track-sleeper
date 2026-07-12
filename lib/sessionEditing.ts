import type { SleepSession } from '@/types'

export function validateSessionEdit(
  sessions: SleepSession[],
  sessionId: string,
  startedAt: string,
  endedAt: string | null,
  now: Date
): string | null {
  const start = Date.parse(startedAt)
  const end = endedAt ? Date.parse(endedAt) : now.getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Enter valid sleep times.'
  if (endedAt && end <= start) return 'End time must be after start time.'
  if (start > now.getTime() || end > now.getTime()) return 'Sleep times cannot be in the future.'
  const overlaps = sessions.some((session) => {
    if (session.id === sessionId) return false
    const otherStart = Date.parse(session.started_at)
    const otherEnd = session.ended_at ? Date.parse(session.ended_at) : now.getTime()
    return otherStart < end && otherEnd > start
  })
  return overlaps ? 'This overlaps another recorded sleep.' : null
}
