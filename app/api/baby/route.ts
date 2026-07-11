import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getBabyForEmail } from '@/lib/babyAccess'
import type { Baby } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let result: { baby: Baby; role: 'owner' | 'caregiver' } | null
  try {
    result = await getBabyForEmail(session.user.email)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (!result) {
    return NextResponse.json({ baby: null, role: null, caregivers: [] })
  }

  if (result.role !== 'owner') {
    return NextResponse.json({ baby: result.baby, role: result.role, caregivers: [] })
  }

  const { data: caregivers, error: caregiversError } = await supabaseAdmin
    .from('baby_caregivers')
    .select('email')
    .eq('baby_id', result.baby.id)

  if (caregiversError) {
    console.error(caregiversError)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({
    baby: result.baby,
    role: result.role,
    caregivers: (caregivers as { email: string }[]) ?? [],
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string; birth_date?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const birthDate = body.birth_date
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate))) {
    return NextResponse.json({ error: 'birth_date must be a valid YYYY-MM-DD date' }, { status: 400 })
  }
  if (new Date(birthDate).getTime() > Date.now()) {
    return NextResponse.json({ error: 'birth_date cannot be in the future' }, { status: 400 })
  }

  const email = session.user.email.toLowerCase()

  let existing: { baby: Baby; role: 'owner' | 'caregiver' } | null
  try {
    existing = await getBabyForEmail(email)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  if (existing && existing.role !== 'owner') {
    return NextResponse.json({ error: 'owner_only' }, { status: 403 })
  }

  const query = existing
    ? supabaseAdmin.from('babies').update({ name, birth_date: birthDate }).eq('id', existing.baby.id)
    : supabaseAdmin.from('babies').insert({ owner_email: email, name, birth_date: birthDate })

  const { data, error } = await query.select().single()

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ baby: data as Baby })
}
