'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import clsx from 'clsx'
import { ArrowRight, MessagesSquare, PlugZap } from 'lucide-react'
import { apiFetch } from '@/lib/apiClient'
import type { AppPreferences, Baby, CaregiverRole } from '@/types'
import { ageInMonths } from '@/lib/sleepModel'
import BottomNav from '@/components/BottomNav'
import { PageSkeleton, LoadErrorCard } from '@/components/Skeleton'
import ChatGptMcpGuide from '@/components/ChatGptMcpGuide'

const APP_VERSION = 'v0.1.0'
const DEFAULT_PREFERENCES: AppPreferences = {
  appearance: 'automatic',
  ai_coach_enabled: false,
  caregiver_updates_enabled: false,
  sleep_window_reminders_enabled: false,
}

function applyAppearance(appearance: AppPreferences['appearance']) {
  document.documentElement.dataset.appearance = appearance
  localStorage.setItem('sommeil:appearance', appearance)
}

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return new Uint8Array(bytes.buffer)
}

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

export default function SettingsClient({ mcpUrl }: { mcpUrl: string }) {
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
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES)
  const [preferenceBusy, setPreferenceBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [res, preferenceRes] = await Promise.all([apiFetch('/api/baby'), apiFetch('/api/preferences')])
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
      if (preferenceRes.ok) {
        const preferenceData: { preferences: AppPreferences } = await preferenceRes.json()
        setPreferences(preferenceData.preferences)
        applyAppearance(preferenceData.preferences.appearance)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }, [])

  async function updatePreferences(patch: Partial<AppPreferences>) {
    const next = { ...preferences, ...patch }
    setPreferences(next)
    applyAppearance(next.appearance)
    setPreferenceBusy(true)
    try {
      const res = await apiFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error()
    } catch {
      setPreferences(preferences)
      setError('Could not save preferences.')
    } finally {
      setPreferenceBusy(false)
    }
  }

  async function enableCaregiverUpdates() {
    const enabling = !preferences.caregiver_updates_enabled
    if (!enabling) {
      const registration = await navigator.serviceWorker?.ready
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await apiFetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) })
        await subscription.unsubscribe()
      }
      await updatePreferences({ caregiver_updates_enabled: false })
      return
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications are not configured or supported on this device.')
      return
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notifications are still off. You can enable them later in iPhone Settings.')
        return
      }
    }
    if (Notification.permission !== 'granted') {
      setError('Notifications are blocked. Enable them for Sommeil in iPhone Settings.')
      return
    }
    const registration = await navigator.serviceWorker.register('/sw.js')
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) })
    const res = await apiFetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
    if (!res.ok) {
      setError('Could not enable caregiver notifications.')
      return
    }
    await updatePreferences({ caregiver_updates_enabled: true })
  }

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
      const res = await apiFetch('/api/baby', {
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
      const res = await apiFetch('/api/baby/share', {
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
      const res = await apiFetch('/api/baby/share', {
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
        <p className="label">Settings</p>
        <h1 className="font-serif text-2xl text-ink">Family</h1>
      </header>

      {error && (
        <p className="mb-6 rounded-xl border border-orange/30 bg-orange/5 px-4 py-3 text-[13px] text-orange">
          {error}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-surface px-5 py-6">
        <h2 className="font-serif text-xl text-ink">Comfort</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Choose how Sommeil looks during late-night updates.</p>
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-sand/55 p-1" aria-label="Appearance">
          {(['automatic', 'light', 'dark'] as const).map((appearance) => (
            <button key={appearance} type="button" disabled={preferenceBusy} onClick={() => updatePreferences({ appearance })} className={clsx('min-h-11 rounded-lg text-xs font-medium capitalize', preferences.appearance === appearance ? 'bg-surface-raised text-ink shadow-sm' : 'text-muted')}>{appearance}</button>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-surface px-5 py-6">
        <h2 className="font-serif text-xl text-ink">Notifications</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Useful updates only. iPhone requires Sommeil to be added to the Home Screen.</p>
        <PreferenceToggle label="Caregiver sleep updates" description="Know when another caregiver starts or ends sleep." checked={preferences.caregiver_updates_enabled} disabled={preferenceBusy} onChange={enableCaregiverUpdates} />
        <PreferenceToggle label="Sleep-window reminders" description="A quiet reminder near the personalized range." checked={preferences.sleep_window_reminders_enabled} disabled={preferenceBusy} onChange={() => updatePreferences({ sleep_window_reminders_enabled: !preferences.sleep_window_reminders_enabled })} />
      </section>

      {role === 'owner' && (
        <section className="mt-8 rounded-2xl border border-line bg-surface px-5 py-6">
          <h2 className="font-serif text-xl text-ink">AI explanations</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">Optional daily wording based only on minimized aggregates. Names, emails, raw times, and session IDs are excluded. Core predictions never depend on AI.</p>
          <PreferenceToggle label="Allow AI daily explanations" description="You can turn this off at any time." checked={preferences.ai_coach_enabled} disabled={preferenceBusy} onChange={() => updatePreferences({ ai_coach_enabled: !preferences.ai_coach_enabled })} />
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-surface px-5 py-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage/10 text-sage">
            <MessagesSquare size={19} aria-hidden="true" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-sage"><PlugZap size={12} /> ChatGPT · MCP</p>
            <h2 className="mt-1 font-serif text-xl text-ink">Talk with your sleep data</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">Connect Sommeil as a private, read-only ChatGPT plugin. No OpenAI API key is required.</p>
          </div>
        </div>
        <details className="settings-mcp-details mt-5 border-t border-line pt-2">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between text-sm font-medium text-ink">
            Setup guide <span className="text-subtle">4 steps</span>
          </summary>
          <ChatGptMcpGuide mcpUrl={mcpUrl} compact />
        </details>
        <Link href="/docs/mcp" className="mt-4 flex min-h-11 items-center justify-between border-t border-line pt-4 text-sm font-medium text-orange">
          Open full documentation <ArrowRight size={16} />
        </Link>
      </section>

      {isCaregiver ? (
        <div className="flex flex-col gap-8 rounded-2xl border border-line bg-surface px-6 py-8">
          <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[0.2em] uppercase text-muted">Baby</span>
            <span className="font-serif text-2xl text-ink">{baby?.name}</span>
          </div>
          {baby && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[0.2em] uppercase text-muted">Age</span>
              <span className="text-[15px] text-ink">{formatAge(ageInMonths(baby.birth_date))} old</span>
            </div>
          )}
          <p className="border-t border-line pt-6 text-[13px] text-muted">Shared with you</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8 rounded-2xl border border-line bg-surface px-6 py-8">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.2em] uppercase text-muted">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
              required
              className="h-12 rounded-xl border border-line-strong bg-surface-raised px-4 text-[16px] text-ink focus:border-orange focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.2em] uppercase text-muted">Birth date</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => {
                setBirthDate(e.target.value)
                setSaved(false)
              }}
              required
              className="h-12 rounded-xl border border-line-strong bg-surface-raised px-4 text-[16px] text-ink focus:border-orange focus:outline-none"
            />
            {birthDate && (
              <span className="text-[13px] text-muted">{formatAge(ageInMonths(birthDate))} old</span>
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
        <section className="mt-8 flex flex-col gap-8 rounded-2xl border border-line bg-surface px-6 py-8">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.2em] uppercase text-muted">Caregivers</span>
            <p className="text-[13px] text-muted">
              They sign in with Google using this email and see the same baby.
            </p>
          </div>

          {caregivers.length > 0 && (
            <ul className="flex flex-col gap-3">
              {caregivers.map((c) => (
                <li
                  key={c.email}
                  className="flex items-center justify-between border-t border-line pt-3 first:border-t-0 first:pt-0"
                >
                  <span className="text-[15px] text-ink">{c.email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.email)}
                    disabled={inviteBusy}
                    className={clsx(
                      'text-[11px] tracking-[0.15em] uppercase transition-colors disabled:opacity-50',
                      confirmRemove === c.email ? 'text-orange' : 'text-subtle'
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
              <span className="text-[11px] tracking-[0.2em] uppercase text-muted">Invite by email</span>
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-12 rounded-xl border border-line-strong bg-surface-raised px-4 text-[16px] text-ink placeholder:text-subtle focus:border-orange focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={inviteBusy || !inviteEmail.trim()}
              className="h-12 rounded-full border border-line-strong text-[13px] tracking-[0.1em] uppercase text-ink transition-colors disabled:opacity-50"
            >
              {inviteBusy ? 'Inviting…' : 'Invite'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="mt-8 h-14 w-full rounded-full border border-line-strong text-[15px] tracking-[0.02em] text-ink transition-colors active:bg-sand/50"
      >
        Sign out
      </button>

      <p className="mt-10 text-center text-[11px] tracking-[0.2em] uppercase text-subtle">
        Sommeil &middot; {APP_VERSION}
      </p>

      <BottomNav />
    </main>
  )
}

function PreferenceToggle({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-5">
      <div><p className="text-sm font-medium text-ink">{label}</p><p className="mt-1 text-xs leading-relaxed text-muted">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange} className={clsx('relative h-8 w-14 shrink-0 rounded-full transition-colors', checked ? 'bg-sage' : 'bg-line-strong')}><span className={clsx('absolute left-1 top-1 h-6 w-6 rounded-full bg-cream shadow-sm transition-transform', checked && 'translate-x-6')} /></button>
    </div>
  )
}
