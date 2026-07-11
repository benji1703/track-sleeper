'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import clsx from 'clsx'
import type { Baby, CaregiverRole } from '@/types'
import { ageInMonths } from '@/lib/sleepModel'
import BottomNav from '@/components/BottomNav'
import { PageSkeleton, LoadErrorCard } from '@/components/Skeleton'

const APP_VERSION = 'v0.1.0'

function formatAge(months: number): string {
  if (months < 1) {
    const weeks = Math.max(0, Math.round(months * 4.345))
    return `${weeks} week${weeks === 1 ? '' : 's'}`
  }
  const whole = Math.floor(months)
  if (whole < 24) return `${whole} month${whole === 1 ? '' : 's'}`
  const years = Math.floor(whole / 12)
  const remMonths = whole % 12
  return remMonths === 0
    ? `${years} year${years === 1 ? '' : 's'}`
    : `${years}y ${remMonths}m`
}

export default function SettingsClient() {
  const [baby, setBaby] = useState<Baby | null | undefined>(undefined)
  const [role, setRole] = useState<CaregiverRole | null>(null)
  const [caregivers, setCaregivers] = useState<{ email: string }[]>([])
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/baby')
      if (!res.ok) throw new Error('Could not load baby profile.')
      const data: { baby: Baby | null; role: CaregiverRole | null; caregivers: { email: string }[] } =
        await res.json()
      setBaby(data.baby)
      setRole(data.role)
      setCaregivers(data.caregivers ?? [])
      if (data.baby) {
        setName(data.baby.name)
        setBirthDate(data.baby.birth_date)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !birthDate) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/baby', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), birth_date: birthDate }),
      })
      if (!res.ok) throw new Error('Could not save changes.')
      const data: { baby: Baby } = await res.json()
      setBaby(data.baby)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteBusy(true)
    setInviteError(null)
    try {
      const res = await fetch('/api/baby/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}) as { error?: string; caregivers?: { email: string }[] })
      if (!res.ok) {
        const message =
          data.error === 'cannot_share_self'
            ? 'You already own this baby.'
            : data.error === 'owner_only'
              ? 'Only the owner can invite caregivers.'
              : 'Enter a valid email address.'
        throw new Error(message)
      }
      setCaregivers(data.caregivers ?? [])
      setInviteEmail('')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setInviteBusy(false)
    }
  }

  async function handleRemove(email: string) {
    if (confirmRemove !== email) {
      setConfirmRemove(email)
      return
    }
    setInviteBusy(true)
    setInviteError(null)
    try {
      const res = await fetch('/api/baby/share', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Could not remove caregiver.')
      const data: { caregivers: { email: string }[] } = await res.json()
      setCaregivers(data.caregivers ?? [])
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setInviteBusy(false)
      setConfirmRemove(null)
    }
  }

  const isCaregiver = role === 'caregiver'

  if (baby === undefined) {
    if (error) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-28">
          <LoadErrorCard message={error} onRetry={load} />
          <BottomNav />
        </main>
      )
    }
    return <PageSkeleton variant="settings" />
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 pb-28 pt-10">
      <header className="mb-10">
        <h1 className="font-serif text-2xl text-ink">Settings</h1>
      </header>

      {error && (
        <p className="mb-6 rounded-xl border border-orange/30 bg-orange/5 px-4 py-3 text-[13px] text-orange">
          {error}
        </p>
      )}

      {isCaregiver ? (
        <div className="flex flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-8">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Baby</span>
            <span className="font-serif text-2xl text-ink">{baby?.name}</span>
          </div>
          {baby && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Age</span>
              <span className="text-[15px] text-ink/70">{formatAge(ageInMonths(baby.birth_date))} old</span>
            </div>
          )}
          <p className="border-t border-ink/15 pt-6 text-[13px] text-ink/50">Shared with you</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-8">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
              required
              className="h-12 rounded-xl border border-ink/15 bg-transparent px-4 text-[16px] text-ink focus:border-orange focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Birth date</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => {
                setBirthDate(e.target.value)
                setSaved(false)
              }}
              required
              className="h-12 rounded-xl border border-ink/15 bg-transparent px-4 text-[16px] text-ink focus:border-orange focus:outline-none"
            />
            {birthDate && (
              <span className="text-[13px] text-ink/50">{formatAge(ageInMonths(birthDate))} old</span>
            )}
          </label>

          <button
            type="submit"
            disabled={busy}
            className="h-14 rounded-full bg-orange text-[15px] tracking-[0.1em] uppercase text-cream transition-opacity disabled:opacity-50"
          >
            {busy ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
          </button>
        </form>
      )}

      {baby && role === 'owner' && (
        <section className="mt-8 flex flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-8">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Caregivers</span>
            <p className="text-[13px] text-ink/50">
              They sign in with Google using this email and see the same baby.
            </p>
          </div>

          {caregivers.length > 0 && (
            <ul className="flex flex-col gap-3">
              {caregivers.map((c) => (
                <li
                  key={c.email}
                  className="flex items-center justify-between border-t border-ink/15 pt-3 first:border-t-0 first:pt-0"
                >
                  <span className="text-[15px] text-ink">{c.email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.email)}
                    disabled={inviteBusy}
                    className={clsx(
                      'text-[11px] tracking-[0.15em] uppercase transition-colors disabled:opacity-50',
                      confirmRemove === c.email ? 'text-orange' : 'text-ink/40'
                    )}
                  >
                    {confirmRemove === c.email ? 'Confirm' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {inviteError && <p className="text-[13px] text-orange">{inviteError}</p>}

          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Invite by email</span>
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-12 rounded-xl border border-ink/15 bg-transparent px-4 text-[16px] text-ink placeholder:text-ink/30 focus:border-orange focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={inviteBusy || !inviteEmail.trim()}
              className="h-12 rounded-full border border-ink/15 text-[13px] tracking-[0.1em] uppercase text-ink transition-colors disabled:opacity-50"
            >
              {inviteBusy ? 'Inviting…' : 'Invite'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="mt-8 h-14 w-full rounded-full border border-ink/15 text-[15px] tracking-[0.02em] text-ink transition-colors active:bg-ink/5"
      >
        Sign out
      </button>

      <p className="mt-10 text-center text-[11px] tracking-[0.2em] uppercase text-ink/30">
        Track Sleeper &middot; {APP_VERSION}
      </p>

      <BottomNav />
    </main>
  )
}
