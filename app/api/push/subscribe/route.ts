import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getBabyForEmail } from '@/lib/babyAccess'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getBabyForEmail(session.user.email)
  if (!access) return NextResponse.json({ error: 'no_baby' }, { status: 404 })
  const subscription = await req.json().catch(() => null) as { endpoint?: string } | null
  if (!subscription?.endpoint || !subscription.endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('push_subscriptions').upsert({
    baby_id: access.baby.id,
    user_email: session.user.email.toLowerCase(),
    endpoint: subscription.endpoint,
    subscription,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { endpoint?: string } | null
  if (!body?.endpoint) return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
  const { error } = await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_email', session.user.email.toLowerCase())
  if (error) return NextResponse.json({ error: 'db_error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
