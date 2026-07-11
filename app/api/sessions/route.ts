import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { SleepSession, SleepType } from '@/types'

export const dynamic = 'force-dynamic'

async function getOwnedBabyId(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('babies')
    .select('id')
    .eq('owner_email', email)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const from = searchParams.get('from') ?? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const to = searchParams.get('to') ?? now.toISOString()

  let babyId: string | null
  try {
    babyId = await getOwnedBabyId(session.user.email)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!babyId) {
    return NextResponse.json({ sessions: [] })
  }

  const { data, error } = await supabaseAdmin
    .from('sleep_sessions')
    .select('*')
    .eq('baby_id', babyId)
    .lt('started_at', to)
    .or(`ended_at.is.null,ended_at.gt.${from}`)
    .order('started_at', { ascending: false })

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ sessions: (data as SleepSession[]) ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    action?: string
    type?: SleepType
    started_at?: string
    ended_at?: string
    notes?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body
  if (action !== 'start' && action !== 'stop' && action !== 'manual') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  let babyId: string | null
  try {
    babyId = await getOwnedBabyId(session.user.email)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!babyId) {
    return NextResponse.json({ error: 'no_baby' }, { status: 404 })
  }

  if (body.type !== undefined && body.type !== 'nap' && body.type !== 'night') {
    return NextResponse.json({ error: 'type must be nap or night' }, { status: 400 })
  }

  if (action === 'start') {
    const { data: open, error: openError } = await supabaseAdmin
      .from('sleep_sessions')
      .select('id')
      .eq('baby_id', babyId)
      .is('ended_at', null)
      .maybeSingle()

    if (openError) {
      console.error(openError)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    if (open) {
      return NextResponse.json({ error: 'already_sleeping' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('sleep_sessions')
      .insert({ baby_id: babyId, started_at: new Date().toISOString(), type: body.type ?? 'nap' })
      .select()
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ session: data as SleepSession }, { status: 201 })
  }

  if (action === 'stop') {
    const { data: open, error: openError } = await supabaseAdmin
      .from('sleep_sessions')
      .select('id')
      .eq('baby_id', babyId)
      .is('ended_at', null)
      .maybeSingle()

    if (openError) {
      console.error(openError)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    if (!open) {
      return NextResponse.json({ error: 'no_open_session' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('sleep_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', open.id)
      .select()
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ session: data as SleepSession })
  }

  // action === 'manual'
  const { started_at, ended_at } = body
  if (!started_at || !ended_at || Number.isNaN(Date.parse(started_at)) || Number.isNaN(Date.parse(ended_at))) {
    return NextResponse.json({ error: 'started_at and ended_at must be valid timestamps' }, { status: 400 })
  }

  const startedMs = Date.parse(started_at)
  const endedMs = Date.parse(ended_at)
  const nowMs = Date.now()

  if (endedMs <= startedMs) {
    return NextResponse.json({ error: 'ended_at must be after started_at' }, { status: 400 })
  }
  if (startedMs > nowMs || endedMs > nowMs) {
    return NextResponse.json({ error: 'started_at and ended_at must be in the past' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('sleep_sessions')
    .insert({
      baby_id: babyId,
      started_at,
      ended_at,
      type: body.type ?? 'nap',
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ session: data as SleepSession }, { status: 201 })
}
