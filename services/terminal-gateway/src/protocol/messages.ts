import {
  AckSchema,
  DataDescriptorSchema,
  ErrorSchema,
  HistoryBeginSchema,
  HistoryChunkSchema,
  HistoryEndSchema,
  ScrollStatusSchema,
  LeaderChangeSchema,
  OkSchema,
  PingSchema,
  PolicySchema,
  PongSchema,
  WelcomeSchema
} from './schema'

export const serialize = (message: unknown): string => JSON.stringify(message)

export const ok = (features: string[]) => OkSchema.parse({ type: 'ok', features })

export const error = (message: string, code = 'BAD_REQUEST', hint?: string) =>
  ErrorSchema.parse({ type: 'error', message, code, hint })

export const ping = (ts: number) => PingSchema.parse({ type: 'ping', ts })

export const pong = (ts: number) => PongSchema.parse({ type: 'pong', ts })

export const historyBegin = (bytes: number) => HistoryBeginSchema.parse({ type: 'history-begin', bytes })

export const historyChunk = (seq: number, dataBase64: string) =>
  HistoryChunkSchema.parse({ type: 'history-chunk', seq, dataBase64 })

export const historyEnd = () => HistoryEndSchema.parse({ type: 'history-end' })

export const dataDescriptor = (seq: number, size: number, source?: 'live' | 'history') =>
  DataDescriptorSchema.parse({ type: 'data', seq, size, ...(source ? { source } : {}) })

export const leaderChange = (clientId: string | null) =>
  LeaderChangeSchema.parse({ type: 'leader-change', clientId })

export const ack = (upToSeq: number) => AckSchema.parse({ type: 'ack', upToSeq })

export const policy = (mode: 'normal' | 'replay-only', reason?: string) =>
  PolicySchema.parse({ type: 'policy', mode, reason })

export const welcome = (clientId: string) => WelcomeSchema.parse({ type: 'welcome', clientId })

export const scrollStatus = (offset: number, limit: number) =>
  ScrollStatusSchema.parse({ type: 'scroll-status', offset, limit })
