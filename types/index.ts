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
  created_by?: string | null
  updated_by?: string | null
  revision?: number
  source?: 'web' | 'offline-replay' | 'manual' | null
}

export type SleepState =
  | { status: 'awake'; session: null }
  | { status: 'sleeping'; session: SleepSession }

export type SleepMutation =
  | { mutation_id: string; action: 'start'; type: SleepType; started_at?: string; source?: string }
  | { mutation_id: string; action: 'stop'; expected_session_id?: string; ended_at?: string; source?: string }

export interface SleepMutationResult {
  mutation_id: string
  session: SleepSession | null
  canonical_state: SleepState
  applied: boolean
  conflict?: 'already_sleeping' | 'already_awake' | 'stale_session'
}

export interface AppPreferences {
  appearance: 'automatic' | 'light' | 'dark'
  ai_coach_enabled: boolean
  caregiver_updates_enabled: boolean
  sleep_window_reminders_enabled: boolean
}

export type CaregiverRole = 'owner' | 'caregiver'

export interface Caregiver {
  id: string
  baby_id: string
  email: string
  invited_by: string
  created_at: string
}
