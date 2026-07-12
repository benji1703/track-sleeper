import type { SleepSession } from '@/types'
import { computeInsights, dailyStats, personalizedWindow, predictNextSleep } from '@/lib/sleepModel'

export interface EvidenceObservation {
  key: string
  text: string
  confidence: 'low' | 'medium' | 'high'
}

export interface DailyBriefing {
  headline: string
  summary: string
  observations: EvidenceObservation[]
  caution: string
}

export interface CoachContext {
  ageBandMonths: string
  date: string
  aggregates: Array<{ date: string; totalMin: number; naps: number; nightMin: number; longestMin: number }>
  observations: EvidenceObservation[]
  confidence: 'low' | 'medium' | 'high'
}

function dateIso(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function ageMonths(birthDate: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(`${birthDate}T12:00:00Z`).getTime()) / (365.2425 / 12 * 86400000))
}

export function buildCoachContext(
  sessions: SleepSession[],
  birthDate: string,
  now: Date,
  tz = 'Asia/Jerusalem'
): CoachContext {
  const model = personalizedWindow(sessions, birthDate, now)
  const insights = computeInsights(sessions, birthDate, now, tz)
  const aggregates = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getTime() - (6 - index) * 86400000)
    const date = dateIso(day, tz)
    const stats = dailyStats(sessions, date, tz)
    return {
      date,
      totalMin: stats.totalMin,
      nightMin: stats.nightMin,
      naps: stats.napCount,
      longestMin: stats.longestMin,
    }
  })

  return {
    ageBandMonths: `${Math.floor(ageMonths(birthDate, now) / 3) * 3}–${Math.floor(ageMonths(birthDate, now) / 3) * 3 + 3}`,
    date: dateIso(now, tz),
    aggregates,
    observations: insights.slice(0, 3).map((insight, index) => ({
      key: `deterministic-${index + 1}`,
      text: insight.text,
      confidence: model.confidence,
    })),
    confidence: model.confidence,
  }
}

export function buildDailyBriefing(
  sessions: SleepSession[],
  birthDate: string,
  now: Date,
  tz = 'Asia/Jerusalem'
): DailyBriefing {
  const context = buildCoachContext(sessions, birthDate, now, tz)
  const yesterday = context.aggregates.at(-2)
  const prediction = predictNextSleep(sessions, birthDate, now)
  const hours = yesterday ? Math.floor(yesterday.totalMin / 60) : 0
  const minutes = yesterday ? Math.round(yesterday.totalMin % 60) : 0
  const evidence: EvidenceObservation[] = [...context.observations]

  if (yesterday) {
    evidence.unshift({
      key: 'yesterday-total',
      text: `Yesterday included ${hours}h ${minutes}m of recorded sleep across ${yesterday.naps} nap${yesterday.naps === 1 ? '' : 's'}.`,
      confidence: context.confidence,
    })
  }
  if (prediction.nextSleepAt) {
    evidence.push({
      key: 'next-window',
      text: `The next sleep estimate uses a ${Math.round(prediction.wakeWindow.minMin)}–${Math.round(prediction.wakeWindow.maxMin)} minute wake window.`,
      confidence: context.confidence,
    })
  }

  return {
    headline: context.confidence === 'low' ? 'Learning this rhythm' : 'Today at a glance',
    summary: evidence[0]?.text ?? 'Keep recording sleep and Sommeil will build a clearer daily picture.',
    observations: evidence,
    caution: 'Sleep estimates are guidance, not medical advice. Follow your baby’s cues.',
  }
}

export function pediatricianCsv(
  sessions: SleepSession[],
  now: Date,
  days = 14,
  tz = 'Asia/Jerusalem'
): string {
  const rows = ['Date,Total sleep (min),Night sleep (min),Naps,Longest stretch (min)']
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = dateIso(new Date(now.getTime() - offset * 86400000), tz)
    const stats = dailyStats(sessions, date, tz)
    rows.push([date, Math.round(stats.totalMin), Math.round(stats.nightMin), stats.napCount, Math.round(stats.longestMin)].join(','))
  }
  return rows.join('\n')
}
