import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getBabyForEmail } from '@/lib/babyAccess'
import { rateLimit } from '@/lib/rateLimit'
import type { SleepSession, SleepType } from '@/types'

export const dynamic = 'force-dynamic'

async function findAccessibleSession(email: string, sessionId: string) {
  const result = await getBabyForEmail(email)
  if (!result) return null

  const { data: existing, error: sessionError } = await supabaseAdmin
    .from('sleep_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('baby_id', result.baby.id)
    .maybeSingle()

  if (sessionError) throw sessionError
  return (existing as SleepSession | null) ?? null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!rateLimit(`sessions:${session.user.email.toLowerCase()}`, 30, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: {
    started_at?: string
    ended_at?: string
    type?: SleepType
    notes?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.type !== undefined && body.type !== 'nap' && body.type !== 'night') {
    return NextResponse.json({ error: 'type must be nap or night' }, { status: 400 })
  }

  let existing: SleepSession | null
  try {
    existing = await findAccessibleSession(session.user.email, id)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const startedAt = body.started_at ?? existing.started_at
  const endedAt = body.ended_at !== undefined ? body.ended_at : existing.ended_at

  if (body.started_at !== undefined && Number.isNaN(Date.parse(body.started_at))) {
    return NextResponse.json({ error: 'started_at must be a valid timestamp' }, { status: 400 })
  }
  if (body.ended_at !== undefined && body.ended_at !== null && Number.isNaN(Date.parse(body.ended_at))) {
    return NextResponse.json({ error: 'ended_at must be a valid timestamp' }, { status: 400 })
  }

  if (endedAt && Date.parse(endedAt) <= Date.parse(startedAt)) {
    return NextResponse.json({ error: 'ended_at must be after started_at' }, { status: 400 })
  }
  if (Date.parse(startedAt) > Date.now() || (endedAt && Date.parse(endedAt) > Date.now())) {
    return NextResponse.json({ error: 'session times must be in the past' }, { status: 400 })
  }

  if (endedAt) {
    const startedIso = new Date(startedAt).toISOString()
    const endedIso = new Date(endedAt).toISOString()
    const { data: overlapping, error: overlapError } = await supabaseAdmin
      .from('sleep_sessions')
      .select('id')
      .eq('baby_id', existing.baby_id)
      .neq('id', existing.id)
      .lt('started_at', endedIso)
      .or(`ended_at.is.null,ended_at.gt.${startedIso}`)
      .limit(1)

    if (overlapError) {
      console.error(overlapError)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({ error: 'overlaps_existing' }, { status: 409 })
    }
  }

  const updates: Record<string, string | null> = {}
  if (body.started_at !== undefined) updates.started_at = body.started_at
  if (body.ended_at !== undefined) updates.ended_at = body.ended_at
  if (body.type !== undefined) updates.type = body.type
  if (body.notes !== undefined) updates.notes = body.notes

  const { data, error } = await supabaseAdmin
    .from('sleep_sessions')
    .update(updates)
    .eq('id', id)
    .eq('baby_id', existing.baby_id)
    .select()
    .single()

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ session: data as SleepSession })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!rateLimit(`sessions:${session.user.email.toLowerCase()}`, 30, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let existing: SleepSession | null
  try {
    existing = await findAccessibleSession(session.user.email, id)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('sleep_sessions')
    .delete()
    .eq('id', id)
    .eq('baby_id', existing.baby_id)

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
