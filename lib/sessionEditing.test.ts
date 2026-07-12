import { describe, expect, it } from 'vitest'
import { validateSessionEdit } from './sessionEditing'
import type { SleepSession } from '@/types'

const existing: SleepSession = { id: 'one', baby_id: 'baby', started_at: '2026-07-12T10:00:00Z', ended_at: '2026-07-12T11:00:00Z', type: 'nap', notes: null, created_at: '2026-07-12T10:00:00Z' }
const now = new Date('2026-07-12T18:00:00Z')

describe('history editor validation', () => {
  it('allows adjacent sessions', () => expect(validateSessionEdit([existing], 'two', '2026-07-12T11:00:00Z', '2026-07-12T12:00:00Z', now)).toBeNull())
  it('rejects overlaps', () => expect(validateSessionEdit([existing], 'two', '2026-07-12T10:30:00Z', '2026-07-12T12:00:00Z', now)).toMatch(/overlaps/))
  it('rejects inverted and future ranges', () => {
    expect(validateSessionEdit([], 'one', '2026-07-12T12:00:00Z', '2026-07-12T11:00:00Z', now)).toMatch(/after start/)
    expect(validateSessionEdit([], 'one', '2026-07-12T19:00:00Z', null, now)).toMatch(/future/)
  })
})
