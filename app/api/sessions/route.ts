import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getBabyForEmail } from '@/lib/babyAccess'
import { rateLimit } from '@/lib/rateLimit'
import type { SleepMutationResult, SleepSession, SleepState, SleepType } from '@/types'
import { notifyCaregivers } from '@/lib/push'

export const dynamic = 'force-dynamic'

const MAX_RETRO_HOURS = 24
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function canonicalState(session: SleepSession | null): SleepState {
  return session ? { status: 'sleeping', session } : { status: 'awake', session: null }
}

async function saveMutation(
  babyId: string,
  actorEmail: string,
  mutationId: string | undefined,
  action: 'start' | 'stop',
  result: SleepMutationResult
) {
  if (!mutationId) return
  const { error } = await supabaseAdmin.from('sleep_mutations').insert({
    baby_id: babyId,
    mutation_id: mutationId,
    actor_email: actorEmail,
    action,
    session_id: result.session?.id ?? null,
    result,
  })
  // A concurrent identical request can win this insert. The session-level
  // constraints still guarantee a canonical state, so uniqueness is benign.
  if (error && error.code !== '23505') throw error
}

async function getAccessibleBabyId(email: string): Promise<string | null> {
  const result = await getBabyForEmail(email)
  return result?.baby.id ?? null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  // Parse + re-serialize the range params: `from` is interpolated into a
  // PostgREST .or() filter string, so it must never carry raw user input.
  const fromMs = Date.parse(searchParams.get('from') ?? '')
  const toMs = Date.parse(searchParams.get('to') ?? '')
  const from = new Date(Number.isNaN(fromMs) ? now.getTime() - 14 * 24 * 60 * 60 * 1000 : fromMs).toISOString()
  const to = new Date(Number.isNaN(toMs) ? now.getTime() : toMs).toISOString()

  let babyId: string | null
  try {
    babyId = await getAccessibleBabyId(session.user.email)
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

  if (!rateLimit(`sessions:${session.user.email.toLowerCase()}`, 30, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: {
    action?: string
    type?: SleepType
    started_at?: string
    ended_at?: string
    notes?: string
    mutation_id?: string
    expected_session_id?: string
    source?: string
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

  if (body.mutation_id !== undefined && !UUID_RE.test(body.mutation_id)) {
    return NextResponse.json({ error: 'mutation_id must be a UUID' }, { status: 400 })
  }

  let babyId: string | null
  try {
    babyId = await getAccessibleBabyId(session.user.email)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!babyId) {
    return NextResponse.json({ error: 'no_baby' }, { status: 404 })
  }


  if (body.mutation_id) {
    const { data: replay, error: replayError } = await supabaseAdmin
      .from('sleep_mutations')
      .select('result')
      .eq('baby_id', babyId)
      .eq('mutation_id', body.mutation_id)
      .maybeSingle()
    if (replayError) {
      console.error(replayError)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
    if (replay) return NextResponse.json(replay.result as SleepMutationResult)
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
      if (body.mutation_id) {
        const { data: current } = await supabaseAdmin.from('sleep_sessions').select('*').eq('id', open.id).single()
        const currentSession = current as SleepSession
        const result: SleepMutationResult = {
          mutation_id: body.mutation_id,
          session: currentSession,
          canonical_state: canonicalState(currentSession),
          applied: false,
          conflict: 'already_sleeping',
        }
        await saveMutation(babyId, session.user.email, body.mutation_id, 'start', result)
        return NextResponse.json(result)
      }
      return NextResponse.json({ error: 'already_sleeping' }, { status: 409 })
    }

    const nowMs = Date.now()
    let startedAt = new Date(nowMs).toISOString()

    if (body.started_at !== undefined) {
      if (Number.isNaN(Date.parse(body.started_at))) {
        return NextResponse.json({ error: 'started_at must be a valid timestamp' }, { status: 400 })
      }
      const startedMs = Date.parse(body.started_at)
      if (startedMs > nowMs) {
        return NextResponse.json({ error: 'started_at must be in the past' }, { status: 400 })
      }
      if (nowMs - startedMs > MAX_RETRO_HOURS * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'started_at_too_old' }, { status: 400 })
      }

      // Normalize to ISO before using in filters/insert; limit(1) because
      // multiple sessions may overlap the retro window (maybeSingle would 500).
      const startedIso = new Date(startedMs).toISOString()
      const { data: overlapping, error: overlapError } = await supabaseAdmin
        .from('sleep_sessions')
        .select('id')
        .eq('baby_id', babyId)
        .not('ended_at', 'is', null)
        .gt('ended_at', startedIso)
        .lt('started_at', new Date(nowMs).toISOString())
        .limit(1)

      if (overlapError) {
        console.error(overlapError)
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }
      if (overlapping && overlapping.length > 0) {
        return NextResponse.json({ error: 'overlaps_existing' }, { status: 409 })
      }

      startedAt = startedIso
    }

    const { data, error } = await supabaseAdmin
      .from('sleep_sessions')
      .insert({
        baby_id: babyId,
        started_at: startedAt,
        type: body.type ?? 'nap',
        created_by: session.user.email.toLowerCase(),
        updated_by: session.user.email.toLowerCase(),
        source: body.source === 'offline-replay' ? 'offline-replay' : 'web',
      })
      .select()
      .single()

    if (error) {
      console.error(error)
      if (error.code === '23505') {
        if (body.mutation_id) {
          const { data: current } = await supabaseAdmin
            .from('sleep_sessions')
            .select('*')
            .eq('baby_id', babyId)
            .is('ended_at', null)
            .single()
          const currentSession = current as SleepSession
          const result: SleepMutationResult = {
            mutation_id: body.mutation_id,
            session: currentSession,
            canonical_state: canonicalState(currentSession),
            applied: false,
            conflict: 'already_sleeping',
          }
          await saveMutation(babyId, session.user.email, body.mutation_id, 'start', result)
          return NextResponse.json(result)
        }
        return NextResponse.json({ error: 'already_sleeping' }, { status: 409 })
      }
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    const created = data as SleepSession
    if (body.mutation_id) {
      const result: SleepMutationResult = {
        mutation_id: body.mutation_id,
        session: created,
        canonical_state: canonicalState(created),
        applied: true,
      }
      await saveMutation(babyId, session.user.email, body.mutation_id, 'start', result)
      await notifyCaregivers(babyId, session.user.email, { title: 'Sleep started', body: 'Baby is sleeping now.', url: '/track', tag: 'sleep-state' }).catch(console.error)
      return NextResponse.json(result, { status: 201 })
    }
    return NextResponse.json({ session: created }, { status: 201 })
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
      if (body.mutation_id) {
        const result: SleepMutationResult = {
          mutation_id: body.mutation_id,
          session: null,
          canonical_state: canonicalState(null),
          applied: false,
          conflict: 'already_awake',
        }
        await saveMutation(babyId, session.user.email, body.mutation_id, 'stop', result)
        return NextResponse.json(result)
      }
      return NextResponse.json({ error: 'no_open_session' }, { status: 404 })
    }

    if (body.expected_session_id && body.expected_session_id !== open.id) {
      const { data: current } = await supabaseAdmin.from('sleep_sessions').select('*').eq('id', open.id).single()
      const currentSession = current as SleepSession
      const result: SleepMutationResult = {
        mutation_id: body.mutation_id!,
        session: currentSession,
        canonical_state: canonicalState(currentSession),
        applied: false,
        conflict: 'stale_session',
      }
      await saveMutation(babyId, session.user.email, body.mutation_id, 'stop', result)
      await notifyCaregivers(babyId, session.user.email, { title: 'Baby woke up', body: 'The shared timeline has been updated.', url: '/track', tag: 'sleep-state' }).catch(console.error)
      return NextResponse.json(result)
    }

    const requestedEndMs = body.ended_at ? Date.parse(body.ended_at) : Date.now()
    const endedAt = Number.isNaN(requestedEndMs) || requestedEndMs > Date.now()
      ? new Date().toISOString()
      : new Date(requestedEndMs).toISOString()

    const { data, error } = await supabaseAdmin
      .from('sleep_sessions')
      .update({
        ended_at: endedAt,
        updated_by: session.user.email.toLowerCase(),
        revision: 2,
        source: body.source === 'offline-replay' ? 'offline-replay' : 'web',
      })
      .eq('id', open.id)
      .is('ended_at', null)
      .select()
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    const stopped = data as SleepSession
    if (body.mutation_id) {
      const result: SleepMutationResult = {
        mutation_id: body.mutation_id,
        session: stopped,
        canonical_state: canonicalState(null),
        applied: true,
      }
      await saveMutation(babyId, session.user.email, body.mutation_id, 'stop', result)
      return NextResponse.json(result)
    }
    return NextResponse.json({ session: stopped })
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

  const startedIso = new Date(startedMs).toISOString()
  const endedIso = new Date(endedMs).toISOString()
  const { data: overlapping, error: overlapError } = await supabaseAdmin
    .from('sleep_sessions')
    .select('id')
    .eq('baby_id', babyId)
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

  const { data, error } = await supabaseAdmin
    .from('sleep_sessions')
    .insert({
      baby_id: babyId,
      started_at: startedIso,
      ended_at: endedIso,
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
