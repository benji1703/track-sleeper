export interface Baby {
  id: string
  owner_email: string
  name: string
  birth_date: string // ISO date, e.g. '2025-01-15'
  created_at: string
}

export type SleepType = 'nap' | 'night'

export interface SleepSession {
  id: string
  baby_id: string
  started_at: string // ISO timestamp
  ended_at: string | null // ISO timestamp, null while sleeping
  type: SleepType
  notes: string | null
  created_at: string
}

export type CaregiverRole = 'owner' | 'caregiver'

export interface Caregiver {
  id: string
  baby_id: string
  email: string
  invited_by: string
  created_at: string
}
