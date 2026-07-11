'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import type { Baby } from '@/types'
import { ageInMonths } from '@/lib/sleepModel'
import BottomNav from '@/components/BottomNav'

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
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/baby')
      if (!res.ok) throw new Error('Could not load baby profile.')
      const data: { baby: Baby | null } = await res.json()
      setBaby(data.baby)
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

      {baby === undefined ? (
        <p className="text-[11px] tracking-[0.2em] uppercase text-ink/40">Loading</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-7">
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
