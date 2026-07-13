import { describe, expect, it } from 'vitest'
import { buildMcpBriefing, buildMcpPrediction, buildMcpSleepSummary, type McpSleepData } from './sleepData'

const data: McpSleepData = {
  baby: {
    id: 'baby-secret-id',
    owner_email: 'family@example.com',
    name: 'Private Name',
    birth_date: '2026-01-01',
    created_at: '2026-01-01T00:00:00Z',
  },
  sessions: [
    {
      id: 'session-secret-id',
      baby_id: 'baby-secret-id',
      started_at: '2026-07-11T10:00:00Z',
      ended_at: '2026-07-11T11:00:00Z',
      type: 'nap',
      notes: 'private note',
      created_at: '2026-07-11T10:00:00Z',
    },
  ],
}

describe('MCP sleep results', () => {
  it('returns useful aggregates without identity or raw records', () => {
    const summary = buildMcpSleepSummary(data, 7, new Date('2026-07-12T12:00:00Z'), 'UTC')
    const serialized = JSON.stringify(summary)
    expect(summary.daily).toHaveLength(7)
    expect(serialized).not.toContain('Private Name')
    expect(serialized).not.toContain('family@example.com')
    expect(serialized).not.toContain('session-secret-id')
    expect(serialized).not.toContain('private note')
    expect(serialized).not.toContain('2026-01-01')
  })

  it('keeps predictions and briefings evidence-bound and cautious', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    const prediction = buildMcpPrediction(data, now)
    const briefing = buildMcpBriefing(data, now, 'UTC')
    expect(prediction.caution).toMatch(/not medical advice/i)
    expect(briefing.caution).toMatch(/not medical advice/i)
    expect(prediction).not.toHaveProperty('sessions')
    expect(briefing).not.toHaveProperty('baby')
  })
})
