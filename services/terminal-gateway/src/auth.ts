import type { IncomingMessage } from 'node:http'

const allowedOrigins = new Set(
  (process.env.TERMINAL_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
)

export function validateOrigin(request: IncomingMessage): boolean {
  if (allowedOrigins.size === 0) {
    // Default: allow localhost origins only
    const origin = request.headers.origin || ''
    if (!origin) {
      return true
    }
    try {
      const url = new URL(origin)
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    } catch {
      return false
    }
  }

  const origin = request.headers.origin || ''
  return allowedOrigins.has(origin)
}

export function validateToken(token?: string | null): boolean {
  const expected = process.env.TERMINAL_WS_TOKEN
  if (!expected) {
    return true
  }
  if (!token) {
    return false
  }
  return token === expected
}
