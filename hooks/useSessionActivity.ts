"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ActivityStatus = 'active' | 'idle'

interface ActivityEntry {
  lastActivity: string
  status: ActivityStatus
}

type ActivityMap = Record<string, ActivityEntry>

const POLL_INTERVAL_MS = 3000
const IS_DEV = process.env.NODE_ENV !== 'production'

export function useSessionActivity(enabled = true) {
  const [activity, setActivity] = useState<ActivityMap>({})
  const [error, setError] = useState<Error | null>(null)
  const latestJsonRef = useRef<string>('')

  const fetchActivity = useCallback(async () => {
    if (!enabled) {
      return
    }

    try {
      const response = await fetch('/api/sessions/activity', {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch activity: ${response.status}`)
      }

      const payload = (await response.json()) as { activity?: ActivityMap }
      const nextActivity = payload.activity ?? {}
      const serialized = JSON.stringify(nextActivity)

      if (latestJsonRef.current !== serialized) {
        latestJsonRef.current = serialized
        setActivity(nextActivity)
      }

      if (error) {
        setError(null)
      }
    } catch (err) {
      if (IS_DEV) {
        console.warn('[useSessionActivity] failed to fetch activity', err)
      }
      setError(err as Error)
    }
  }, [enabled, error])

  useEffect(() => {
    if (!enabled) {
      return
    }

    void fetchActivity()
    const interval = setInterval(fetchActivity, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [enabled, fetchActivity])

  const hasActivity = useMemo(() => Object.keys(activity).length > 0, [activity])

  return {
    activity,
    error,
    hasActivity
  }
}
