import { getBabyForEmail } from '@/lib/babyAccess'
import { sleepTimezone } from '@/lib/mcp/config'
import { supabaseAdmin } from '@/lib/supabase'
import {
  ageInMonths,
  computeInsights,
  dailyStats,
  personalizedWindow,
  predictNextSleep,
} from '@/lib/sleepModel'
import { buildDailyBriefing } from '@/lib/sleepBriefing'
import type { Baby, SleepSession } from '@/types'

export interface McpSleepData {
  baby: Baby
  sessions: SleepSession[]
}

function dateIso(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function ageBand(birthDate: string, now: Date): string {
  const lower = Math.max(0, Math.floor(ageInMonths(birthDate, now) / 3) * 3)
  return `${lower}-${lower + 3} months`
}

export async function loadMcpSleepData(email: string): Promise<McpSleepData | null> {
  const access = await getBabyForEmail(email)
  if (!access) return null
  const from = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('sleep_sessions')
    .select('*')
    .eq('baby_id', access.baby.id)
    .or(`ended_at.is.null,ended_at.gt.${from}`)
    .order('started_at')
  if (error) throw error
  return { baby: access.baby, sessions: (data as SleepSession[]) ?? [] }
}

export function buildMcpSleepSummary(data: McpSleepData, days: number, now = new Date(), timeZone = sleepTimezone()) {
  const daily = Array.from({ length: days }, (_, index) => {
    const date = dateIso(new Date(now.getTime() - (days - 1 - index) * 24 * 60 * 60 * 1000), timeZone)
    const stats = dailyStats(data.sessions, date, timeZone)
    return {
      date,
      totalSleepMin: Math.round(stats.totalMin),
      nightSleepMin: Math.round(stats.nightMin),
      napCount: stats.napCount,
      longestStretchMin: Math.round(stats.longestMin),
    }
  })
  const totals = daily.reduce((sum, day) => ({
    sleep: sum.sleep + day.totalSleepMin,
    night: sum.night + day.nightSleepMin,
    naps: sum.naps + day.napCount,
  }), { sleep: 0, night: 0, naps: 0 })
  const model = personalizedWindow(data.sessions, data.baby.birth_date, now)
  const prediction = predictNextSleep(data.sessions, data.baby.birth_date, now)

  return {
    generatedAt: now.toISOString(),
    timeZone,
    ageBand: ageBand(data.baby.birth_date, now),
    days,
    averages: {
      totalSleepMin: Math.round(totals.sleep / days),
      nightSleepMin: Math.round(totals.night / days),
      napsPerDay: Math.round((totals.naps / days) * 10) / 10,
    },
    daily,
    currentStatus: prediction.status,
    personalization: {
      confidence: model.confidence,
      sampleCount: model.sampleCount,
      wakeWindowMin: Math.round(model.window.minMin),
      wakeWindowMax: Math.round(model.window.maxMin),
    },
    observations: computeInsights(data.sessions, data.baby.birth_date, now, timeZone).slice(0, 3).map((item) => item.text),
    caution: 'Sleep estimates are guidance, not medical advice. Follow the baby’s cues.',
  }
}

export function buildMcpPrediction(data: McpSleepData, now = new Date()) {
  const prediction = predictNextSleep(data.sessions, data.baby.birth_date, now)
  const model = personalizedWindow(data.sessions, data.baby.birth_date, now)
  return {
    generatedAt: now.toISOString(),
    status: prediction.status,
    estimatedNextSleepAt: prediction.nextSleepAt?.toISOString() ?? null,
    lastWakeAt: prediction.lastWakeAt?.toISOString() ?? null,
    wakeWindowMin: Math.round(prediction.wakeWindow.minMin),
    wakeWindowMax: Math.round(prediction.wakeWindow.maxMin),
    confidence: model.confidence,
    sampleCount: model.sampleCount,
    caution: 'This estimate is not medical advice. Follow the baby’s cues.',
  }
}

export function buildMcpBriefing(data: McpSleepData, now = new Date(), timeZone = sleepTimezone()) {
  const briefing = buildDailyBriefing(data.sessions, data.baby.birth_date, now, timeZone)
  return {
    generatedAt: now.toISOString(),
    timeZone,
    ageBand: ageBand(data.baby.birth_date, now),
    ...briefing,
  }
}
