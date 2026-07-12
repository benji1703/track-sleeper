import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import LandingClient from '@/components/marketing/LandingClient'
import { authOptions } from '@/lib/auth'

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/track')
  return <LandingClient />
}
