import type { Session } from '@/types/session'

const API_BASE_URL = '/api'
const IS_DEV = process.env.NODE_ENV !== 'production'
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.NEXT_PUBLIC_SESSIONS_FETCH_TIMEOUT ?? '5000', 10)

export async function fetchSessions(): Promise<Session[]> {
  const start = performance.now()
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), Number.isFinite(FETCH_TIMEOUT_MS) ? FETCH_TIMEOUT_MS : 5000)
    : null

  try {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      signal: controller?.signal,
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    if (IS_DEV) {
      console.info('[fetchSessions] success', {
        durationMs: Math.round(performance.now() - start),
        count: data.sessions?.length ?? 0
      })
    }
    return data.sessions || []
  } catch (error) {
    if (IS_DEV) {
      console.error('[fetchSessions] error', {
        durationMs: Math.round(performance.now() - start),
        error
      })
    }
    throw error
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
