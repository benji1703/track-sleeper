import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getBabyForEmail } from '@/lib/babyAccess'
import { supabaseAdmin } from '@/lib/supabase'
import { buildCoachContext, buildDailyBriefing, type DailyBriefing } from '@/lib/sleepBriefing'
import type { AppPreferences, SleepSession } from '@/types'

export const dynamic = 'force-dynamic'

const BRIEFING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', maxLength: 80 },
    summary: { type: 'string', maxLength: 360 },
    observations: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claim: { type: 'string', maxLength: 240 },
          evidenceKeys: { type: 'array', items: { type: 'string' }, minItems: 1 },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['claim', 'evidenceKeys', 'confidence'],
      },
    },
    caution: { type: 'string', maxLength: 180 },
  },
  required: ['headline', 'summary', 'observations', 'caution'],
} as const

function responseText(payload: unknown): string | null {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  if (data.output_text) return data.output_text
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) return content.text
    }
  }
  return null
}

function validateGenerated(value: unknown, evidence: Set<string>): DailyBriefing | null {
  const candidate = value as {
    headline?: unknown
    summary?: unknown
    caution?: unknown
    observations?: Array<{ claim?: unknown; evidenceKeys?: unknown; confidence?: unknown }>
  }
  if (typeof candidate.headline !== 'string' || typeof candidate.summary !== 'string' || typeof candidate.caution !== 'string' || !Array.isArray(candidate.observations)) return null
  if (/diagnos|disease|disorder|treatment|medication/i.test(`${candidate.headline} ${candidate.summary} ${candidate.caution}`)) return null
  const observations = candidate.observations.map((item, index) => {
    if (typeof item.claim !== 'string' || !Array.isArray(item.evidenceKeys) || !item.evidenceKeys.every((key) => typeof key === 'string' && evidence.has(key))) return null
    if (item.confidence !== 'low' && item.confidence !== 'medium' && item.confidence !== 'high') return null
    return { key: `ai-${index + 1}`, text: item.claim, confidence: item.confidence }
  })
  if (observations.some((item) => item === null)) return null
  return { headline: candidate.headline, summary: candidate.summary, caution: candidate.caution, observations: observations as DailyBriefing['observations'] }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getBabyForEmail(session.user.email)
  if (!access) return NextResponse.json({ error: 'no_baby' }, { status: 404 })

  const now = new Date()
  const from = new Date(now.getTime() - 30 * 86400000).toISOString()
  const [{ data: sessions, error: sessionError }, { data: preference }] = await Promise.all([
    supabaseAdmin.from('sleep_sessions').select('*').eq('baby_id', access.baby.id).or(`ended_at.is.null,ended_at.gt.${from}`).order('started_at'),
    supabaseAdmin.from('app_preferences').select('ai_coach_enabled').eq('baby_id', access.baby.id).eq('user_email', session.user.email.toLowerCase()).maybeSingle(),
  ])
  if (sessionError) return NextResponse.json({ error: 'db_error' }, { status: 500 })

  const sleepSessions = (sessions as SleepSession[]) ?? []
  const fallback = buildDailyBriefing(sleepSessions, access.baby.birth_date, now)
  const optedIn = Boolean((preference as Pick<AppPreferences, 'ai_coach_enabled'> | null)?.ai_coach_enabled)
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.AI_SLEEP_MODEL
  if (!optedIn || !apiKey || !model) return NextResponse.json({ briefing: fallback, generated: false })

  const context = buildCoachContext(sleepSessions, access.baby.birth_date, now)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 500,
        input: [
          { role: 'system', content: 'Write a calm baby-sleep daily explanation using only the supplied evidence. Do not diagnose, give medical advice, invent causes, or introduce new numbers. Every observation must cite evidenceKeys from the input.' },
          { role: 'user', content: JSON.stringify(context) },
        ],
        text: { format: { type: 'json_schema', name: 'sleep_briefing', strict: true, schema: BRIEFING_SCHEMA } },
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('model_error')
    const text = responseText(await response.json())
    const generated = text ? validateGenerated(JSON.parse(text), new Set(context.observations.map((item) => item.key))) : null
    return NextResponse.json({ briefing: generated ?? fallback, generated: Boolean(generated) })
  } catch {
    return NextResponse.json({ briefing: fallback, generated: false })
  }
}
