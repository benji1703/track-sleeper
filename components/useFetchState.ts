// Shared data-fetching state machine used by TrackerClient, HistoryClient and
// SettingsClient so loading/error/retry handling stays consistent across pages.

import { useCallback, useEffect, useState } from 'react'

export interface FetchState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fn()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Something went wrong.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  useEffect(() => {
    return load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, reload }
}
