import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { SleepSession, SleepType } from '@/types'

export const dynamic = 'force-dynamic'

async function findOwnedSession(email: string, sessionId: string) {
  const { data: baby, error: babyError } = await supabaseAdmin
    .from('babies')
    .select('id')
    .eq('owner_email', email)
    .maybeSingle()

  if (babyError) throw babyError
  if (!baby) return null

  const { data: existing, error: sessionError } = await supabaseAdmin
    .from('sleep_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('baby_id', baby.id)
    .maybeSingle()

  if (sessionError) throw sessionError
  return (existing as SleepSession | null) ?? null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    existing = await findOwnedSession(session.user.email, params.id)
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

  const updates: Record<string, string | null> = {}
  if (body.started_at !== undefined) updates.started_at = body.started_at
  if (body.ended_at !== undefined) updates.ended_at = body.ended_at
  if (body.type !== undefined) updates.type = body.type
  if (body.notes !== undefined) updates.notes = body.notes

  const { data, error } = await supabaseAdmin
    .from('sleep_sessions')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ session: data as SleepSession })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let existing: SleepSession | null
  try {
    existing = await findOwnedSession(session.user.email, params.id)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('sleep_sessions').delete().eq('id', params.id)

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
