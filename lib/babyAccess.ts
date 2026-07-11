import { supabaseAdmin } from '@/lib/supabase'
import type { Baby, CaregiverRole } from '@/types'

// Resolves the baby a user can access: the baby they own, or one they were
// invited to as a caregiver (matched by lowercased email).
export async function getBabyForEmail(
  email: string
): Promise<{ baby: Baby; role: CaregiverRole } | null> {
  // All emails are stored lowercase (migration 003); fold at the boundary so
  // IdP casing quirks can never split one mailbox into two identities.
  const normalized = email.toLowerCase()

  const { data: owned, error: ownedError } = await supabaseAdmin
    .from('babies')
    .select('*')
    .eq('owner_email', normalized)
    .maybeSingle()

  if (ownedError) throw ownedError
  if (owned) {
    return { baby: owned as Baby, role: 'owner' }
  }

  // limit(1): a user may be invited to more than one baby; we surface the
  // earliest invite rather than erroring (single-baby UX for now).
  const { data: invites, error: inviteError } = await supabaseAdmin
    .from('baby_caregivers')
    .select('baby_id')
    .eq('email', normalized)
    .order('created_at', { ascending: true })
    .limit(1)

  if (inviteError) throw inviteError
  const invite = invites?.[0]
  if (!invite) return null

  const { data: baby, error: babyError } = await supabaseAdmin
    .from('babies')
    .select('*')
    .eq('id', invite.baby_id)
    .maybeSingle()

  if (babyError) throw babyError
  if (!baby) return null

  return { baby: baby as Baby, role: 'caregiver' }
}
