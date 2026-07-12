import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getBabyForEmail } from '@/lib/babyAccess'
import { supabaseAdmin } from '@/lib/supabase'
import type { AppPreferences } from '@/types'

const DEFAULTS: AppPreferences = {
  appearance: 'automatic',
  ai_coach_enabled: false,
  caregiver_updates_enabled: false,
  sleep_window_reminders_enabled: false,
}

async function context() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const access = await getBabyForEmail(session.user.email)
  return access ? { ...access, email: session.user.email.toLowerCase() } : null
}

export async function GET() {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('app_preferences')
    .select('appearance,ai_coach_enabled,caregiver_updates_enabled,sleep_window_reminders_enabled')
    .eq('baby_id', ctx.baby.id)
    .eq('user_email', ctx.email)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ preferences: (data as AppPreferences | null) ?? DEFAULTS })
}

export async function PUT(req: NextRequest) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Partial<AppPreferences> | null
  if (!body || (body.appearance && !['automatic', 'light', 'dark'].includes(body.appearance))) {
    return NextResponse.json({ error: 'invalid_preferences' }, { status: 400 })
  }
  const preferences: AppPreferences = {
    appearance: body.appearance ?? DEFAULTS.appearance,
    ai_coach_enabled: ctx.role === 'owner' ? Boolean(body.ai_coach_enabled) : false,
    caregiver_updates_enabled: Boolean(body.caregiver_updates_enabled),
    sleep_window_reminders_enabled: Boolean(body.sleep_window_reminders_enabled),
  }
  const { error } = await supabaseAdmin.from('app_preferences').upsert({
    baby_id: ctx.baby.id,
    user_email: ctx.email,
    ...preferences,
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ preferences })
}
