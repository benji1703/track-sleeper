import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getBabyForEmail } from '@/lib/babyAccess'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function requireOwnedBaby(email: string) {
  const result = await getBabyForEmail(email)
  if (!result || result.role !== 'owner') return null
  return result.baby
}

async function currentCaregivers(babyId: string) {
  const { data, error } = await supabaseAdmin
    .from('baby_caregivers')
    .select('email')
    .eq('baby_id', babyId)

  if (error) throw error
  return (data as { email: string }[]) ?? []
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!rateLimit(`share:${session.user.email.toLowerCase()}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawEmail = body.email?.trim()
  if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  const email = rawEmail.toLowerCase()

  if (email === session.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'cannot_share_self' }, { status: 400 })
  }

  let baby
  try {
    baby = await requireOwnedBaby(session.user.email)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  if (!baby) {
    return NextResponse.json({ error: 'owner_only' }, { status: 403 })
  }

  const { error: upsertError } = await supabaseAdmin
    .from('baby_caregivers')
    .upsert(
      { baby_id: baby.id, email, invited_by: session.user.email.toLowerCase() },
      { onConflict: 'baby_id,email', ignoreDuplicates: true }
    )

  if (upsertError) {
    console.error(upsertError)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  try {
    const caregivers = await currentCaregivers(baby.id)
    return NextResponse.json({ caregivers })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawEmail = body.email?.trim()
  if (!rawEmail) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  const email = rawEmail.toLowerCase()

  let baby
  try {
    baby = await requireOwnedBaby(session.user.email)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  if (!baby) {
    return NextResponse.json({ error: 'owner_only' }, { status: 403 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('baby_caregivers')
    .delete()
    .eq('baby_id', baby.id)
    .eq('email', email)

  if (deleteError) {
    console.error(deleteError)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  try {
    const caregivers = await currentCaregivers(baby.id)
    return NextResponse.json({ caregivers })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
