'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import { LoadErrorCard, PageSkeleton } from '@/components/Skeleton'
import { TZ, dateISOInTz } from '@/components/timeUtils'
import { apiFetch } from '@/lib/apiClient'
import { computeInsights, dailyStats, personalizedWindow } from '@/lib/sleepModel'
import { fmtDuration } from '@/lib/format'
import { buildDailyBriefing, pediatricianCsv } from '@/lib/sleepBriefing'
import type { DailyBriefing } from '@/lib/sleepBriefing'
import type { Baby, SleepSession } from '@/types'

interface LoadedInsights {
  baby: Baby
  sessions: SleepSession[]
}

export default function InsightsClient() {
  const root = useRef<HTMLElement>(null)
  const [data, setData] = useState<LoadedInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coachBriefing, setCoachBriefing] = useState<DailyBriefing | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const to = new Date()
      const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000)
      const [babyRes, sessionsRes, coachRes] = await Promise.all([
        apiFetch('/api/baby'),
        apiFetch(`/api/sessions?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`),
        apiFetch('/api/coach'),
      ])
      if (!babyRes.ok || !sessionsRes.ok) throw new Error('Could not load insights.')
      const babyJson: { baby: Baby | null } = await babyRes.json()
      const sessionsJson: { sessions: SleepSession[] } = await sessionsRes.json()
      if (!babyJson.baby) throw new Error('Add a baby profile before viewing insights.')
      setData({ baby: babyJson.baby, sessions: sessionsJson.sessions })
      if (coachRes.ok) {
        const coachJson: { briefing: DailyBriefing } = await coachRes.json()
        setCoachBriefing(coachJson.briefing)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const summary = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const days = Array.from({ length: 14 }, (_, reverseIndex) => {
      const index = 13 - reverseIndex
      const date = new Date(now.getTime() - index * 24 * 3600 * 1000)
      const iso = dateISOInTz(date, TZ)
      const stats = dailyStats(data.sessions, iso, TZ)
      return {
        iso,
        label: new Intl.DateTimeFormat('en', { weekday: 'narrow', timeZone: TZ }).format(date),
        totalMin: stats.totalMin,
        naps: stats.napCount,
      }
    })
    const previous = days.slice(0, 7).reduce((sum, day) => sum + day.totalMin, 0) / 7
    const current = days.slice(7).reduce((sum, day) => sum + day.totalMin, 0) / 7
    const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0
    const model = personalizedWindow(data.sessions, data.baby.birth_date, now)
    const insights = computeInsights(data.sessions, data.baby.birth_date, now)
    const briefing = coachBriefing ?? buildDailyBriefing(data.sessions, data.baby.birth_date, now, TZ)
    return { days, current, delta, model, insights, briefing, max: Math.max(...days.map((day) => day.totalMin), 60) }
  }, [data, coachBriefing])

  useGSAP(() => {
    if (!summary) return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-insight-reveal]', { opacity: 0, y: 18, duration: 0.55, stagger: 0.07, ease: 'power3.out' })
      gsap.from('[data-insight-bar]', { scaleY: 0, transformOrigin: 'bottom center', duration: 0.7, stagger: 0.025, ease: 'power2.out', delay: 0.15 })
    })
    return () => media.revert()
  }, { scope: root, dependencies: [summary] })

  if (loading) return <PageSkeleton variant="history" />
  if (!data || !summary) {
    return <main className="page-shell flex flex-col justify-center"><LoadErrorCard message={error ?? 'No insights yet.'} onRetry={() => { setLoading(true); load() }} /><BottomNav /></main>
  }

  const TrendIcon = summary.delta > 2 ? ArrowUpRight : summary.delta < -2 ? ArrowDownRight : ArrowRight
  const trendText = Math.abs(summary.delta) < 2 ? 'Steady' : `${Math.abs(summary.delta).toFixed(0)}% ${summary.delta > 0 ? 'more' : 'less'}`

  function exportReport() {
    const csv = pediatricianCsv(data!.sessions, new Date(), 14, TZ)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sommeil-sleep-report-${dateISOInTz(new Date(), TZ)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main ref={root} className="page-shell insights-page">
      <header data-insight-reveal className="insights-header">
        <p>{data.baby.name}</p>
        <h1>Insights</h1>
      </header>

      {error && <p role="alert" className="insights-error">{error}</p>}

      <section data-insight-reveal className="daily-briefing" aria-labelledby="daily-briefing-title">
        <div><Sparkles size={17} /><span>Daily briefing</span></div>
        <h2 id="daily-briefing-title">{summary.briefing.headline}</h2>
        <p>{summary.briefing.summary}</p>
        <details>
          <summary>Why am I seeing this?</summary>
          <ul>{summary.briefing.observations.map((item) => <li key={item.key}>{item.text}</li>)}</ul>
          <small>{summary.briefing.caution}</small>
        </details>
      </section>

      <section data-insight-reveal className="insights-lead">
        <div><span>7-day average</span><strong>{fmtDuration(summary.current)}</strong></div>
        <div><span>vs previous week</span><strong><TrendIcon size={20} />{trendText}</strong></div>
      </section>

      <section data-insight-reveal className="insights-chart" aria-label="Fourteen day sleep totals">
        <header><div><span>Daily rhythm</span><small>Hours slept</small></div><b>14 days</b></header>
        <div className="insights-bars">
          {summary.days.map((day, index) => (
            <div key={day.iso} className="insights-bar-column">
              <i data-insight-bar style={{ height: `${Math.max(4, (day.totalMin / summary.max) * 100)}%` }} title={`${fmtDuration(day.totalMin)}, ${day.naps} naps`} />
              <span>{index === 7 ? 'Now' : day.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section data-insight-reveal className="insights-model">
        <div><Sparkles size={18} /><span>Personalization</span></div>
        <strong>{summary.model.confidence === 'low' ? 'Learning your rhythm' : `${summary.model.confidence} confidence`}</strong>
        <p>{summary.model.sampleCount} wake windows are shaping a personal range of {fmtDuration(summary.model.window.minMin)}–{fmtDuration(summary.model.window.maxMin)}.</p>
      </section>

      <section data-insight-reveal className="insights-notes">
        <h2>Worth noticing</h2>
        {summary.insights.length > 0 ? summary.insights.slice(0, 3).map((insight, index) => <p key={`${insight.text}-${index}`}>{insight.text}</p>) : <p>Keep logging completed sleeps. Patterns will appear here as the history grows.</p>}
      </section>

      <button type="button" onClick={exportReport} className="report-export">Export 14-day pediatrician report</button>

      <BottomNav />
    </main>
  )
}
