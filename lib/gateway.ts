const DEFAULT_GATEWAY_PORT = process.env.TERMINAL_WS_PORT
  ? Number.parseInt(process.env.TERMINAL_WS_PORT, 10)
  : 23001

const baseUrl = process.env.TERMINAL_GATEWAY_HTTP_URL
  || `http://127.0.0.1:${Number.isFinite(DEFAULT_GATEWAY_PORT) ? DEFAULT_GATEWAY_PORT : 23001}`

const ACTIVITY_TIMEOUT_MS = process.env.TERMINAL_GATEWAY_ACTIVITY_TIMEOUT
  ? Number.parseInt(process.env.TERMINAL_GATEWAY_ACTIVITY_TIMEOUT, 10)
  : 250

const IS_DEV = process.env.NODE_ENV !== 'production'

interface ActivityResponse {
  sessions: Array<{ session: string; lastActivity: number }>
}

let lastSnapshot: Map<string, number> = new Map()

export async function getGatewayActivity(): Promise<Map<string, number>> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => {
        controller.abort()
      }, Number.isFinite(ACTIVITY_TIMEOUT_MS) ? ACTIVITY_TIMEOUT_MS : 500)
    : null
  try {
    const response = await fetch(`${baseUrl}/activity`, {
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store',
      signal: controller?.signal
    })

    if (!response.ok) {
      return lastSnapshot
    }

    const payload = (await response.json()) as ActivityResponse
    const nextSnapshot = new Map<string, number>()
    for (const entry of payload.sessions ?? []) {
      if (entry.session) {
        nextSnapshot.set(entry.session, entry.lastActivity)
      }
    }
    lastSnapshot = nextSnapshot
    return nextSnapshot
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (IS_DEV) {
        console.info('Gateway activity request timed out')
      }
    } else {
      console.warn('Failed to fetch activity from gateway:', error)
    }
    return lastSnapshot
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
