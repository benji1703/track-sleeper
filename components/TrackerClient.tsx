'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Baby, SleepSession, SleepType } from '@/types'
import { predictNextSleep, dailyStats } from '@/lib/sleepModel'
import { fmtTime, fmtDuration } from '@/lib/format'
import BottomNav from '@/components/BottomNav'
import { TZ, MS_PER_MIN, dayBoundsInTz, dateISOInTz, localHourInTz } from '@/components/timeUtils'

export default function TrackerClient() {
  const [baby, setBaby] = useState<Baby | null | undefined>(undefined)
  const [sessions, setSessions] = useState<SleepSession[]>([])
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [manualType, setManualType] = useState<SleepType>(() =>
    isNightHour(localHourInTz(new Date(), TZ)) ? 'night' : 'nap'
  )
  const [onboardName, setOnboardName] = useState('')
  const [onboardBirth, setOnboardBirth] = useState('')

  function isNightHour(hour: number) {
    return hour >= 19 || hour < 6
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const babyRes = await fetch('/api/baby')
      if (!babyRes.ok) throw new Error('Could not load baby profile.')
      const babyData: { baby: Baby | null } = await babyRes.json()
      setBaby(babyData.baby)

      if (babyData.baby) {
        const to = new Date()
        const from = new Date(to.getTime() - 36 * 3600 * 1000)
        const sessionsRes = await fetch(
          `/api/sessions?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(
            to.toISOString()
          )}`
        )
        if (!sessionsRes.ok) throw new Error('Could not load sleep sessions.')
        const sessionsData: { sessions: SleepSession[] } = await sessionsRes.json()
        setSessions(sessionsData.sessions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openSession = useMemo(() => sessions.find((s) => s.ended_at === null), [sessions])

  // Live tick: every second while sleeping, every 30s otherwise.
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), openSession ? 1000 : 30_000)
    return () => clearInterval(interval)
  }, [openSession])

  useEffect(() => {
    if (!openSession) {
      setManualType(isNightHour(localHourInTz(now, TZ)) ? 'night' : 'nap')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSession])

  async function handleOnboard(e: React.FormEvent) {
    e.preventDefault()
    if (!onboardName.trim() || !onboardBirth) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/baby', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: onboardName.trim(), birth_date: onboardBirth }),
      })
      if (!res.ok) throw new Error('Could not save baby profile.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', type: manualType }),
      })
      if (res.status === 409) throw new Error('Already asleep.')
      if (!res.ok) throw new Error('Could not start sleep.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStop() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      if (!res.ok) throw new Error('Could not stop sleep.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (baby === undefined) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-[11px] tracking-[0.2em] uppercase text-ink/40">Loading</p>
      </main>
    )
  }

  if (baby === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-6">
        <form
          onSubmit={handleOnboard}
          className="flex w-full max-w-xs flex-col gap-8 rounded-2xl border border-ink/15 p-7"
        >
          <div className="flex flex-col gap-2 text-center">
            <p className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Welcome</p>
            <h1 className="font-serif text-2xl text-ink">Tell us about your baby</h1>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Name</span>
            <input
              type="text"
              value={onboardName}
              onChange={(e) => setOnboardName(e.target.value)}
              placeholder="Baby's name"
              required
              className="h-12 rounded-xl border border-ink/15 bg-transparent px-4 text-[16px] text-ink placeholder:text-ink/30 focus:border-orange focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Birth date</span>
            <input
              type="date"
              value={onboardBirth}
              onChange={(e) => setOnboardBirth(e.target.value)}
              required
              className="h-12 rounded-xl border border-ink/15 bg-transparent px-4 text-[16px] text-ink focus:border-orange focus:outline-none"
            />
          </label>

          {error && <p className="text-[13px] text-orange">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="h-14 rounded-full bg-orange text-[15px] tracking-[0.02em] text-cream transition-opacity disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Start tracking'}
          </button>
        </form>
      </main>
    )
  }

  const todayISO = dateISOInTz(now, TZ)
  const stats = dailyStats(sessions, todayISO, TZ)
  const { dayStart, dayEnd } = dayBoundsInTz(todayISO, TZ)
  const daySpanMs = dayEnd.getTime() - dayStart.getTime()

  const segments = sessions
    .map((s) => {
      const start = new Date(s.started_at)
      const end = s.ended_at ? new Date(s.ended_at) : now
      const clippedStart = start < dayStart ? dayStart : start
      const clippedEnd = end > dayEnd ? dayEnd : end
      if (clippedEnd <= clippedStart) return null
      const leftPct = ((clippedStart.getTime() - dayStart.getTime()) / daySpanMs) * 100
      const widthPct = ((clippedEnd.getTime() - clippedStart.getTime()) / daySpanMs) * 100
      return { id: s.id, leftPct, widthPct }
    })
    .filter((s): s is { id: string; leftPct: number; widthPct: number } => s !== null)

  const prediction = predictNextSleep(sessions, baby.birth_date, now)

  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 pb-28 pt-10">
      <header className="mb-10 flex flex-col gap-1">
        <p className="text-[11px] tracking-[0.2em] uppercase text-ink/50">{baby.name}</p>
        <h1 className="font-serif text-2xl text-ink">
          {openSession ? 'Sleeping' : 'Awake'}
        </h1>
      </header>

      {error && (
        <p className="mb-6 rounded-xl border border-orange/30 bg-orange/5 px-4 py-3 text-[13px] text-orange">
          {error}
        </p>
      )}

      {openSession ? (
        <SleepingCard session={openSession} now={now} onStop={handleStop} busy={busy} />
      ) : (
        <AwakeCard
          prediction={prediction}
          manualType={manualType}
          onTypeChange={setManualType}
          onStart={handleStart}
          busy={busy}
        />
      )}

      <section className="mt-10 flex flex-col gap-4">
        <p className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Today</p>
        <div className="relative h-8 overflow-hidden rounded-full border border-ink/15 bg-sand/40">
          {segments.map((seg) => (
            <div
              key={seg.id}
              className="absolute inset-y-0 bg-orange"
              style={{ left: `${seg.leftPct}%`, width: `${Math.max(seg.widthPct, 0.6)}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11px] tracking-[0.15em] uppercase text-ink/35">
          <span>00:00</span>
          <span>12:00</span>
          <span>24:00</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Total slept</span>
            <span className="font-serif text-2xl text-ink">{fmtDuration(stats.totalMin)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Naps</span>
            <span className="font-serif text-2xl text-ink">{stats.napCount}</span>
          </div>
        </div>
      </section>

      <BottomNav />
    </main>
  )
}

function SleepingCard({
  session,
  now,
  onStop,
  busy,
}: {
  session: SleepSession
  now: Date
  onStop: () => void
  busy: boolean
}) {
  const startedAt = new Date(session.started_at)
  const elapsedMin = (now.getTime() - startedAt.getTime()) / MS_PER_MIN
  const elapsedH = Math.floor(elapsedMin / 60)
  const elapsedM = Math.floor(elapsedMin % 60)
  const elapsedS = Math.floor((elapsedMin * 60) % 60)

  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl border border-ink/15 px-6 py-10 text-center">
      <p className="text-[11px] tracking-[0.2em] uppercase text-ink/50">
        Asleep since {fmtTime(startedAt)}
      </p>
      <p className="font-serif text-6xl tabular-nums text-ink">
        {elapsedH > 0 ? `${elapsedH}:` : ''}
        {String(elapsedM).padStart(2, '0')}
        <span className="text-3xl text-ink/40">:{String(elapsedS).padStart(2, '0')}</span>
      </p>
      <button
        type="button"
        onClick={onStop}
        disabled={busy}
        className="h-14 w-full max-w-[220px] rounded-full bg-orange text-[15px] tracking-[0.1em] uppercase text-cream transition-opacity disabled:opacity-50"
      >
        Stop
      </button>
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  'awake-ok': 'Awake',
  'tired-soon': 'Tired soon',
  overtired: 'Overtired',
}

function AwakeCard({
  prediction,
  manualType,
  onTypeChange,
  onStart,
  busy,
}: {
  prediction: ReturnType<typeof predictNextSleep>
  manualType: SleepType
  onTypeChange: (t: SleepType) => void
  onStart: () => void
  busy: boolean
}) {
  const chipClass = clsx(
    'inline-flex items-center rounded-full px-3 py-1 text-[11px] tracking-[0.15em] uppercase',
    prediction.status === 'awake-ok' && 'bg-sage/15 text-sage',
    prediction.status === 'tired-soon' && 'border border-orange text-orange',
    prediction.status === 'overtired' && 'bg-orange text-cream'
  )

  return (
    <div className="flex flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className={chipClass}>{STATUS_LABEL[prediction.status] ?? prediction.status}</span>
        {prediction.nextSleepAt ? (
          <p className="font-serif text-5xl text-ink">Next ~{fmtTime(prediction.nextSleepAt)}</p>
        ) : (
          <p className="font-serif text-3xl text-ink">Ready when you are</p>
        )}
        <p className="text-[13px] text-ink/50">
          Wake window {fmtDuration(prediction.wakeWindow.minMin)}–
          {fmtDuration(prediction.wakeWindow.maxMin)}
        </p>
      </div>

      <div className="flex items-center justify-center gap-1 rounded-full border border-ink/15 p-1">
        {(['nap', 'night'] as SleepType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={clsx(
              'flex-1 rounded-full py-2 text-[11px] tracking-[0.2em] uppercase transition-colors',
              manualType === t ? 'bg-ink text-cream' : 'text-ink/50'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className="h-14 w-full rounded-full bg-orange text-[15px] tracking-[0.1em] uppercase text-cream transition-opacity disabled:opacity-50"
      >
        Start sleep
      </button>
    </div>
  )
}
