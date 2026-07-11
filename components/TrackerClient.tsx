'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import type { Baby, SleepSession, SleepType } from '@/types'
import { predictNextSleep, dailyStats, ageInMonths } from '@/lib/sleepModel'
import { sleepInfoForAge, SLEEP_SOURCES, WAKE_WINDOW_CAVEAT } from '@/lib/sleepInfo'
import { fmtTime, fmtDuration } from '@/lib/format'
import BottomNav from '@/components/BottomNav'
import { PageSkeleton, LoadErrorCard } from '@/components/Skeleton'
import { TZ, MS_PER_MIN, dayBoundsInTz, dateISOInTz, localHourInTz } from '@/components/timeUtils'

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

type TimeField = 'hour' | 'minute'

// macOS-style date/time field: click a segment to select it, then use the
// stepper or arrow/digit keys to adjust — mirrors NSDatePicker field editing.
function MacTimePicker({
  value,
  onChange,
  max,
}: {
  value: string
  onChange: (v: string) => void
  max: string
}) {
  const [field, setField] = useState<TimeField>('hour')
  const [typedBuffer, setTypedBuffer] = useState('')

  const date = useMemo(() => new Date(value), [value])
  const maxDate = useMemo(() => new Date(max), [max])
  const today = useMemo(() => new Date(), [])
  const yesterday = useMemo(() => new Date(today.getTime() - 24 * 3600 * 1000), [today])

  function clamp(next: Date) {
    return next > maxDate ? maxDate : next
  }

  function setPart(hour: number, minute: number, dayOffsetFrom = date) {
    const next = new Date(dayOffsetFrom)
    next.setHours(hour, minute, 0, 0)
    onChange(toDatetimeLocal(clamp(next)))
  }

  function setDay(base: Date) {
    const next = new Date(base)
    next.setHours(date.getHours(), date.getMinutes(), 0, 0)
    onChange(toDatetimeLocal(clamp(next)))
  }

  function step(delta: number) {
    setTypedBuffer('')
    if (field === 'hour') {
      setPart((date.getHours() + delta + 24) % 24, date.getMinutes())
    } else {
      let h = date.getHours()
      let m = date.getMinutes() + delta
      if (m < 0) {
        m += 60
        h = (h - 1 + 24) % 24
      } else if (m > 59) {
        m -= 60
        h = (h + 1) % 24
      }
      setPart(h, m)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, f: TimeField) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setField(f)
      step(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setField(f)
      step(-1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setField('hour')
      setTypedBuffer('')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setField('minute')
      setTypedBuffer('')
    } else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      const limit = f === 'hour' ? 23 : 59
      const combined = Number(typedBuffer + e.key)
      const usesCombined = typedBuffer !== '' && combined <= limit
      const digits = usesCombined ? typedBuffer + e.key : e.key
      const parsed = Number(digits)

      if (f === 'hour') setPart(parsed, date.getMinutes())
      else setPart(date.getHours(), parsed)

      if (digits.length === 2) {
        setTypedBuffer('')
        if (f === 'hour') setField('minute')
      } else {
        setTypedBuffer(digits)
      }
    }
  }

  const isToday = isSameLocalDay(date, today)
  const isYesterday = isSameLocalDay(date, yesterday)

  return (
    <div className="flex items-center gap-3">
      <div className="flex overflow-hidden rounded-lg border border-ink/15">
        <button
          type="button"
          onClick={() => setDay(today)}
          className={clsx(
            'px-3 py-2 text-[11px] tracking-[0.1em] uppercase transition-colors',
            isToday ? 'bg-ink text-cream' : 'bg-transparent text-ink/50'
          )}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setDay(yesterday)}
          className={clsx(
            'px-3 py-2 text-[11px] tracking-[0.1em] uppercase transition-colors',
            isYesterday ? 'bg-ink text-cream' : 'bg-transparent text-ink/50'
          )}
        >
          Yesterday
        </button>
      </div>

      <div className="flex items-stretch rounded-lg border border-ink/15 bg-white/40">
        <div className="flex items-center gap-[2px] px-3 font-serif text-xl font-semibold tabular-nums text-ink">
          <button
            type="button"
            tabIndex={0}
            onClick={() => {
              setField('hour')
              setTypedBuffer('')
            }}
            onKeyDown={(e) => handleKeyDown(e, 'hour')}
            className={clsx(
              'rounded px-0.5 outline-none',
              field === 'hour' && 'bg-orange/15 text-orange'
            )}
          >
            {String(date.getHours()).padStart(2, '0')}
          </button>
          <span className="text-ink/30">:</span>
          <button
            type="button"
            tabIndex={0}
            onClick={() => {
              setField('minute')
              setTypedBuffer('')
            }}
            onKeyDown={(e) => handleKeyDown(e, 'minute')}
            className={clsx(
              'rounded px-0.5 outline-none',
              field === 'minute' && 'bg-orange/15 text-orange'
            )}
          >
            {String(date.getMinutes()).padStart(2, '0')}
          </button>
        </div>
        <div className="flex flex-col divide-y divide-ink/15 border-l border-ink/15">
          <button
            type="button"
            aria-label="Increase"
            onClick={() => step(1)}
            className="flex flex-1 items-center justify-center px-2 text-[9px] text-ink/50 hover:text-orange active:bg-ink/5"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Decrease"
            onClick={() => step(-1)}
            className="flex flex-1 items-center justify-center px-2 text-[9px] text-ink/50 hover:text-orange active:bg-ink/5"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [retroOpen, setRetroOpen] = useState(false)
  const [retroValue, setRetroValue] = useState('')
  const [retroAdjusted, setRetroAdjusted] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  function isNightHour(hour: number) {
    return hour >= 19 || hour < 6
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const babyRes = await fetch('/api/baby')
      if (!babyRes.ok) throw new Error('Could not load baby profile.')
      const babyData: { baby: Baby | null } = await babyRes.json()

      // Fetch sessions BEFORE committing any state: setting `baby` early
      // renders the awake card with empty data ("Ready when you are")
      // instead of the skeleton.
      let loadedSessions: SleepSession[] = []
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
        loadedSessions = sessionsData.sessions
      }
      setSessions(loadedSessions)
      setBaby(babyData.baby)
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

  function openRetro() {
    setRetroValue(toDatetimeLocal(new Date()))
    setRetroAdjusted(false)
    setRetroOpen(true)
  }

  function resetRetro() {
    setRetroValue(toDatetimeLocal(new Date()))
    setRetroAdjusted(false)
  }

  async function handleStart() {
    setBusy(true)
    setError(null)
    try {
      const body: { action: 'start'; type: SleepType; started_at?: string } = {
        action: 'start',
        type: manualType,
      }
      if (retroOpen && retroAdjusted && retroValue) {
        body.started_at = new Date(retroValue).toISOString()
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        const message =
          data.error === 'already_sleeping'
            ? 'Already asleep.'
            : data.error === 'overlaps_existing'
              ? 'Overlaps an existing session.'
              : data.error === 'started_at_too_old'
                ? 'Start time can be at most 24 hours ago.'
                : 'Could not start sleep.'
        throw new Error(message)
      }
      setRetroOpen(false)
      setRetroAdjusted(false)
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
    if (error) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-28">
          <LoadErrorCard message={error} onRetry={load} />
          <BottomNav />
        </main>
      )
    }
    return <PageSkeleton variant="tracker" />
  }

  if (baby === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center p-6">
        <form
          onSubmit={handleOnboard}
          className="flex w-full max-w-xs flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-8"
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
  const ageMonths = ageInMonths(baby.birth_date, now)

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
          retroOpen={retroOpen}
          retroValue={retroValue}
          onRetroOpen={openRetro}
          onRetroChange={(v) => {
            setRetroValue(v)
            setRetroAdjusted(true)
          }}
          onRetroReset={resetRetro}
          onWakeWindowTap={() => setSheetOpen(true)}
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
        {segments.length === 0 && (
          <p className="-mt-2 text-[13px] italic text-ink/35">Nothing tracked today yet</p>
        )}
        <div className="flex justify-between text-[11px] tracking-[0.15em] uppercase text-ink/35">
          <span>00:00</span>
          <span>12:00</span>
          <span>24:00</span>
        </div>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Total slept</span>
            <span className="font-serif text-2xl font-semibold tabular-nums text-ink">{fmtDuration(stats.totalMin)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Naps</span>
            <span className="font-serif text-2xl font-semibold tabular-nums text-ink">{stats.napCount}</span>
          </div>
        </div>
      </section>

      {sheetOpen && (
        <SleepInfoSheet ageMonths={ageMonths} onClose={() => setSheetOpen(false)} />
      )}

      <BottomNav />
    </main>
  )
}

function SleepInfoSheet({ ageMonths, onClose }: { ageMonths: number; onClose: () => void }) {
  const info = sleepInfoForAge(ageMonths)

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/20" onClick={onClose}>
      <div
        className="mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-ink/15 bg-cream px-6 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-ink/15" />

        <p className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Sleep guidance</p>
        <h2 className="mb-8 font-serif text-2xl text-ink">{info.label}</h2>

        <dl className="flex flex-col gap-4 border-t border-ink/15 pt-6">
          <InfoRow label="Wake window" value={info.wakeWindow} />
          <InfoRow label="Naps per day" value={info.napsPerDay} />
          <InfoRow label="Night sleep" value={info.nightSleep} />
          <InfoRow label="Total per 24h" value={info.total24h} />
        </dl>

        <p className="mt-8 text-[14px] leading-relaxed text-ink/70">{info.notes}</p>

        <p className="mt-6 text-[12px] italic leading-relaxed text-ink/45">{WAKE_WINDOW_CAVEAT}</p>

        <div className="mt-8 flex flex-col gap-2 border-t border-ink/15 pt-6">
          <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Sources</span>
          {SLEEP_SOURCES.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-ink/60 underline underline-offset-2"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[11px] tracking-[0.2em] uppercase text-ink/50">{label}</dt>
      <dd className="font-serif text-lg text-ink">{value}</dd>
    </div>
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
      <p className="font-serif text-6xl font-semibold tabular-nums text-ink">
        {elapsedH > 0 ? `${elapsedH}:` : ''}
        {String(elapsedM).padStart(2, '0')}
        <span className="text-3xl font-medium text-ink/40">:{String(elapsedS).padStart(2, '0')}</span>
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
  retroOpen,
  retroValue,
  onRetroOpen,
  onRetroChange,
  onRetroReset,
  onWakeWindowTap,
}: {
  prediction: ReturnType<typeof predictNextSleep>
  manualType: SleepType
  onTypeChange: (t: SleepType) => void
  onStart: () => void
  busy: boolean
  retroOpen: boolean
  retroValue: string
  onRetroOpen: () => void
  onRetroChange: (v: string) => void
  onRetroReset: () => void
  onWakeWindowTap: () => void
}) {
  const chipClass = clsx(
    'inline-flex items-center rounded-full px-3 py-1 text-[11px] tracking-[0.15em] uppercase',
    prediction.status === 'awake-ok' && 'bg-sage/15 text-sage',
    prediction.status === 'tired-soon' && 'border border-orange text-orange',
    prediction.status === 'overtired' && 'bg-orange text-cream'
  )
  const nowLocal = toDatetimeLocal(new Date())

  return (
    <div className="flex flex-col gap-8 rounded-2xl border border-ink/15 px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className={chipClass}>{STATUS_LABEL[prediction.status] ?? prediction.status}</span>
        {prediction.nextSleepAt ? (
          <p className="font-serif text-5xl font-semibold tabular-nums text-ink">
            Next <span className="font-normal text-ink/50">~</span>
            {fmtTime(prediction.nextSleepAt)}
          </p>
        ) : (
          <p className="font-serif text-3xl text-ink">Ready when you are</p>
        )}
        <button
          type="button"
          onClick={onWakeWindowTap}
          className="text-[13px] text-ink/50 underline decoration-ink/25 underline-offset-4"
        >
          Wake window {fmtDuration(prediction.wakeWindow.minMin)}–
          {fmtDuration(prediction.wakeWindow.maxMin)} ›
        </button>
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

      {retroOpen ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Started at</span>
            <button
              type="button"
              onClick={onRetroReset}
              className="text-[11px] tracking-[0.15em] uppercase text-orange"
            >
              Use current time
            </button>
          </div>
          <div className="flex justify-center">
            <MacTimePicker value={retroValue} onChange={onRetroChange} max={nowLocal} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={onRetroOpen} className="text-[13px] italic text-ink/40">
          Started earlier?
        </button>
      )}

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
