import { describe, expect, it } from 'vitest'
import { buildCoachContext, buildDailyBriefing, pediatricianCsv } from './sleepBriefing'
import type { SleepSession } from '@/types'

const session: SleepSession = {
  id: 's1', baby_id: 'b1', started_at: '2026-07-11T10:00:00Z', ended_at: '2026-07-11T11:00:00Z',
  type: 'nap', notes: null, created_at: '2026-07-11T10:00:00Z',
}

describe('privacy-safe coaching', () => {
  it('contains aggregates without identity or raw sessions', () => {
    const context = buildCoachContext([session], '2026-01-01', new Date('2026-07-12T12:00:00Z'), 'UTC')
    expect(context).not.toHaveProperty('name')
    expect(JSON.stringify(context)).not.toContain('s1')
    expect(context.aggregates).toHaveLength(7)
  })

  it('always includes a safety caution', () => {
    const briefing = buildDailyBriefing([session], '2026-01-01', new Date('2026-07-12T12:00:00Z'), 'UTC')
    expect(briefing.caution).toMatch(/not medical advice/i)
  })

  it('exports a stable daily CSV', () => {
    const csv = pediatricianCsv([session], new Date('2026-07-12T12:00:00Z'), 2, 'UTC')
    expect(csv.split('\n')).toHaveLength(3)
    expect(csv).toContain('2026-07-11,60,0,1,60')
  })
})
