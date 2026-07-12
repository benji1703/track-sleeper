import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

interface StoredSubscription {
  id: string
  user_email: string
  subscription: webpush.PushSubscription
}

export async function notifyCaregivers(
  babyId: string,
  actorEmail: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id,user_email,subscription')
    .eq('baby_id', babyId)
    .neq('user_email', actorEmail.toLowerCase())
  if (error) throw error

  await Promise.allSettled(((data as StoredSubscription[]) ?? []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload), { TTL: 300, urgency: 'normal' })
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }))
}
