'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@/types/session'
import { fetchSessions } from '@/lib/api'

const REFRESH_INTERVAL = 10000 // 10 seconds
const INITIAL_LOAD_TIMEOUT = 3000
const IS_DEV = process.env.NODE_ENV !== 'production'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadSessions = useCallback(async () => {
    const timeout = setTimeout(() => {
      if (IS_DEV) {
        console.warn('[useSessions] Initial session load taking longer than expected...')
      }
    }, INITIAL_LOAD_TIMEOUT)
    const start = performance.now()
    try {
      setLoading(true)
      setError(null)
      const data = await fetchSessions()
      setSessions(data)
      if (IS_DEV) {
        console.info('[useSessions] Loaded sessions', {
          count: data.length,
          durationMs: Math.round(performance.now() - start)
        })
      }
    } catch (err) {
      if (IS_DEV) {
        console.error('Failed to load sessions:', err)
      }
      setError(err as Error)
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [])

  const refreshSessions = useCallback(() => {
    loadSessions()
  }, [loadSessions])

  // Initial load
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadSessions()
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [loadSessions])

  return {
    sessions,
    loading,
    error,
    refreshSessions,
  }
}
