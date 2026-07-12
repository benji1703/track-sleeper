'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import type { SleepSession, SleepType } from '@/types'
import { dailyStats } from '@/lib/sleepModel'
import { fmtDuration, fmtDate } from '@/lib/format'
import BottomNav from '@/components/BottomNav'
import { PageSkeleton, LoadErrorCard } from '@/components/Skeleton'
import { TZ, dayBoundsInTz, dateISOInTz } from '@/components/timeUtils'
import { apiFetch } from '@/lib/apiClient'
import { validateSessionEdit } from '@/lib/sessionEditing'

const DAYS_BACK = 14

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export default function HistoryClient() {
  const [sessions, setSessions] = useState<SleepSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SleepSession | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)

  const [manualStart, setManualStart] = useState('')
  const [manualEnd, setManualEnd] = useState('')
  const [manualType, setManualType] = useState<SleepType>('nap')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editType, setEditType] = useState<SleepType>('nap')
  const [editError, setEditError] = useState<string | null>(null)
  const [recentEdit, setRecentEdit] = useState<{ before: SleepSession; after: SleepSession } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const to = new Date()
      const from = new Date(to.getTime() - DAYS_BACK * 24 * 3600 * 1000)
      const res = await apiFetch(
        `/api/sessions?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(
          to.toISOString()
        )}`
      )
      if (!res.ok) throw new Error('Could not load history.')
      const data: { sessions: SleepSession[] } = await res.json()
      setSessions(data.sessions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const days = useMemo(() => {
    const now = new Date()
    return Array.from({ length: DAYS_BACK }, (_, i) => {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000)
      const dayISO = dateISOInTz(d, TZ)
      const { dayStart, dayEnd } = dayBoundsInTz(dayISO, TZ)
      const daySpanMs = dayEnd.getTime() - dayStart.getTime()

      const segments = sessions
        .map((s) => {
          const start = new Date(s.started_at)
          const end = s.ended_at ? new Date(s.ended_at) : now
          const clippedStart = start < dayStart ? dayStart : start
          const clippedEnd = end > dayEnd ? dayEnd : end
          if (clippedEnd <= clippedStart) return null
          return {
            session: s,
            leftPct: ((clippedStart.getTime() - dayStart.getTime()) / daySpanMs) * 100,
            widthPct: ((clippedEnd.getTime() - clippedStart.getTime()) / daySpanMs) * 100,
          }
        })
        .filter((s): s is { session: SleepSession; leftPct: number; widthPct: number } => s !== null)

      const stats = dailyStats(sessions, dayISO, TZ)
      return { dayISO, dayStart, segments, stats }
    })
  }, [sessions])

  const daysWithData = useMemo(() => days.filter((d) => d.segments.length > 0), [days])
  const hasAnySessions = sessions.length > 0

  const weekAvg = useMemo(() => {
    const lastWeek = days.slice(0, 7).filter((d) => d.segments.length > 0)
    if (lastWeek.length === 0) return { avgTotalMin: 0, avgNaps: 0 }
    const totalMin = lastWeek.reduce((sum, d) => sum + d.stats.totalMin, 0)
    const naps = lastWeek.reduce((sum, d) => sum + d.stats.napCount, 0)
    return { avgTotalMin: totalMin / lastWeek.length, avgNaps: naps / lastWeek.length }
  }, [days])

  const weekDaysWithData = useMemo(
    () => days.slice(0, 7).filter((d) => d.segments.length > 0).length,
    [days]
  )

  function openDetail(session: SleepSession) {
    setSelected(session)
    setEditStart(toDatetimeLocal(new Date(session.started_at)))
    setEditEnd(session.ended_at ? toDatetimeLocal(new Date(session.ended_at)) : '')
    setEditType(session.type)
    setEditError(null)
    setConfirmDelete(false)
  }

  function closeDetail() {
    setSelected(null)
    setConfirmDelete(false)
  }

  function adjustEdit(field: 'start' | 'end', minutes: number) {
    const value = field === 'start' ? editStart : editEnd
    const base = value ? new Date(value) : new Date()
    const next = toDatetimeLocal(new Date(base.getTime() + minutes * 60_000))
    if (field === 'start') setEditStart(next)
    else setEditEnd(next)
    setEditError(null)
  }

  const editDurationMin = editStart && editEnd
    ? Math.round((new Date(editEnd).getTime() - new Date(editStart).getTime()) / 60_000)
    : null

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !editStart) return
    const startedAt = new Date(editStart).toISOString()
    const endedAt = editEnd ? new Date(editEnd).toISOString() : null
    const validationError = validateSessionEdit(sessions, selected.id, startedAt, endedAt, new Date())
    if (validationError) {
      setEditError(validationError)
      return
    }

    const before = selected
    const after = { ...selected, started_at: startedAt, ended_at: endedAt, type: editType }
    setSessions((current) => current.map((session) => session.id === after.id ? after : session))
    setRecentEdit({ before, after })
    closeDetail()
    setBusy(true)
    try {
      const res = await apiFetch(`/api/sessions/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ started_at: startedAt, ended_at: endedAt, type: editType }),
      })
      const data = await res.json().catch(() => ({})) as { session?: SleepSession; error?: string }
      if (!res.ok || !data.session) throw new Error(data.error === 'overlaps_existing' ? 'This overlaps another recorded sleep.' : 'Could not save this edit.')
      setSessions((current) => current.map((session) => session.id === data.session!.id ? data.session! : session))
      window.setTimeout(() => setRecentEdit(null), 5000)
    } catch (err) {
      setSessions((current) => current.map((session) => session.id === before.id ? before : session))
      setRecentEdit(null)
      setError(err instanceof Error ? err.message : 'Could not save this edit.')
    } finally {
      setBusy(false)
    }
  }

  async function undoEdit() {
    if (!recentEdit) return
    const { before, after } = recentEdit
    setRecentEdit(null)
    setSessions((current) => current.map((session) => session.id === before.id ? before : session))
    const res = await apiFetch(`/api/sessions/${before.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ started_at: before.started_at, ended_at: before.ended_at, type: before.type }),
    })
    if (!res.ok) {
      setSessions((current) => current.map((session) => session.id === after.id ? after : session))
      setError('Could not undo the edit.')
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/sessions/${selected.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete session.')
      closeDetail()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function openAddForm() {
    const now = new Date()
    const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    setManualStart(toDatetimeLocal(anHourAgo))
    setManualEnd(toDatetimeLocal(now))
    setManualType('nap')
    setShowAdd(true)
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault()
    if (!manualStart || !manualEnd) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual',
          started_at: new Date(manualStart).toISOString(),
          ended_at: new Date(manualEnd).toISOString(),
          type: manualType,
        }),
      })
      if (!res.ok) throw new Error('Could not add session.')
      setShowAdd(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <PageSkeleton variant="history" />
  }

  if (error && sessions.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-28">
        <LoadErrorCard
          message={error}
          onRetry={() => {
            setLoading(true)
            load()
          }}
        />
        <BottomNav />
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 pb-28 pt-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="font-serif text-2xl text-ink">Timeline</h1>
        <button
          type="button"
          onClick={openAddForm}
          className="text-[11px] tracking-[0.2em] uppercase text-orange"
        >
          + Add manually
        </button>
      </header>

      {error && (
        <p className="mb-6 rounded-xl border border-orange/30 bg-orange/5 px-4 py-3 text-[13px] text-orange">
          {error}
        </p>
      )}

      {weekDaysWithData >= 3 && (
        <section className="mb-8 grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 rounded-2xl border border-ink/15 px-5 py-4">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">7-day avg sleep</span>
            <span className="font-serif text-3xl font-bold tabular-nums text-ink">{fmtDuration(weekAvg.avgTotalMin)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-ink/15 px-5 py-4">
            <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Avg naps/day</span>
            <span className="font-serif text-3xl font-bold tabular-nums text-ink">{weekAvg.avgNaps.toFixed(1)}</span>
          </div>
        </section>
      )}

      {!hasAnySessions ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink/15 px-6 py-10 text-center">
          <h2 className="font-serif text-2xl text-ink">No sleep recorded yet</h2>
          <p className="text-[13px] text-ink/50">
            Start a session to see it show up here.
          </p>
          <Link
            href="/track"
            className="mt-2 text-[11px] tracking-[0.2em] uppercase text-orange"
          >
            Go to Track
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-5">
          {daysWithData.map((day) => (
            <li key={day.dayISO} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink/70">{fmtDate(day.dayStart)}</span>
                <span className="font-serif text-lg font-bold tabular-nums text-ink">{fmtDuration(day.stats.totalMin)}</span>
              </div>
              <div className="relative h-6 overflow-hidden rounded-full border border-ink/15 bg-sand/40">
                {day.segments.map((seg, i) => (
                  <button
                    key={`${seg.session.id}-${i}`}
                    type="button"
                    onClick={() => openDetail(seg.session)}
                    className={clsx(
                      'absolute inset-y-0',
                      seg.session.type === 'night' ? 'bg-ink' : 'bg-orange'
                    )}
                    style={{ left: `${seg.leftPct}%`, width: `${Math.max(seg.widthPct, 0.6)}%` }}
                    aria-label={`${seg.session.type} sleep segment`}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/30 backdrop-blur-[2px]" onClick={closeDetail}>
          <form
            onSubmit={handleEdit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-sleep-title"
            className="history-editor mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t border-ink/15 bg-cream px-5 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <div className="mb-5 flex items-center justify-between">
              <button type="button" onClick={closeDetail} className="min-h-11 px-2 text-sm text-ink/55">Cancel</button>
              <h2 id="edit-sleep-title" className="font-serif text-xl text-ink">Edit sleep</h2>
              <button type="submit" disabled={busy} className="min-h-11 px-2 text-sm font-semibold text-orange disabled:opacity-50">Save</button>
            </div>

            <div className="mb-5 flex items-center justify-center gap-1 rounded-xl bg-ink/5 p-1" aria-label="Sleep type">
              {(['nap', 'night'] as SleepType[]).map((type) => (
                <button key={type} type="button" onClick={() => setEditType(type)} className={clsx('min-h-11 flex-1 rounded-lg text-sm font-medium capitalize', editType === type ? 'bg-white text-ink shadow-sm' : 'text-ink/50')}>{type === 'night' ? 'Night sleep' : 'Nap'}</button>
              ))}
            </div>

            <TimeEditor label="Fell asleep" value={editStart} onChange={setEditStart} onAdjust={(minutes) => adjustEdit('start', minutes)} />
            <TimeEditor label={editEnd ? 'Woke up' : 'Still sleeping'} value={editEnd} onChange={setEditEnd} onAdjust={(minutes) => adjustEdit('end', minutes)} allowEmpty />

            <div className="my-5 rounded-xl border border-ink/10 bg-white/30 px-4 py-3 text-center">
              <span className="label">Duration</span>
              <p className="mt-1 font-serif text-2xl text-ink">{editDurationMin !== null && editDurationMin > 0 ? fmtDuration(editDurationMin) : editEnd ? 'Check times' : 'Ongoing'}</p>
            </div>

            {editError && <p role="alert" className="mb-4 rounded-xl bg-orange/10 px-4 py-3 text-sm text-orange">{editError}</p>}

            <button type="button" onClick={handleDelete} disabled={busy} className={clsx('min-h-12 w-full rounded-xl text-sm font-medium transition-colors disabled:opacity-50', confirmDelete ? 'bg-orange text-white' : 'text-orange')}>{confirmDelete ? 'Tap again to delete' : 'Delete sleep'}</button>
          </form>
        </div>
      )}

      {recentEdit && <div className="undo-toast" role="status"><span>Sleep updated</span><button type="button" onClick={undoEdit}>Undo</button></div>}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/20" onClick={() => setShowAdd(false)}>
          <form
            onSubmit={handleAddManual}
            className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-t-2xl border-t border-ink/15 bg-cream p-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">
                Add sleep session
              </span>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="text-[11px] tracking-[0.2em] uppercase text-ink/50"
              >
                Close
              </button>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">Start</span>
              <input
                type="datetime-local"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                required
                className="h-12 rounded-xl border border-ink/15 bg-transparent px-4 text-[16px] text-ink focus:border-orange focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[11px] tracking-[0.2em] uppercase text-ink/50">End</span>
              <input
                type="datetime-local"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                required
                className="h-12 rounded-xl border border-ink/15 bg-transparent px-4 text-[16px] text-ink focus:border-orange focus:outline-none"
              />
            </label>

            <div className="flex items-center justify-center gap-1 rounded-full border border-ink/15 p-1">
              {(['nap', 'night'] as SleepType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setManualType(t)}
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
              type="submit"
              disabled={busy}
              className="h-14 rounded-full bg-orange text-[15px] tracking-[0.1em] uppercase text-cream disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}

      <BottomNav />
    </main>
  )
}

function TimeEditor({
  label,
  value,
  onChange,
  onAdjust,
  allowEmpty = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onAdjust: (minutes: number) => void
  allowEmpty?: boolean
}) {
  return (
    <fieldset className="history-time-editor mb-4 rounded-2xl border border-ink/10 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <legend className="label">{label}</legend>
        {allowEmpty && value && <button type="button" onClick={() => onChange('')} className="min-h-11 px-2 text-xs text-ink/50">Mark ongoing</button>}
      </div>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={!allowEmpty}
        max={toDatetimeLocal(new Date())}
        className="h-14 w-full rounded-xl border border-ink/10 bg-white/30 px-3 text-[17px] font-medium tabular-nums text-ink"
      />
      <div className="mt-3 grid grid-cols-4 gap-2" aria-label={`Adjust ${label.toLowerCase()}`}>
        {[-15, -5, 5, 15].map((minutes) => (
          <button key={minutes} type="button" onClick={() => onAdjust(minutes)} className="min-h-11 rounded-xl bg-ink/5 px-1 text-xs font-medium text-ink/60">
            {minutes > 0 ? '+' : '−'}{Math.abs(minutes)}m
          </button>
        ))}
      </div>
    </fieldset>
  )
}
