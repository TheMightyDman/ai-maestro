import { z } from 'zod'

export const SessionNameSchema = z.string().regex(/^[A-Za-z0-9_-]+$/)

export const HelloSchema = z.object({
  type: z.literal('hello'),
  version: z.string(),
  token: z.string().optional()
})

export const JoinSchema = z.object({
  type: z.literal('join'),
  sessionName: SessionNameSchema
})

export const PingSchema = z.object({
  type: z.literal('ping'),
  ts: z.number().nonnegative()
})

export const PongSchema = z.object({
  type: z.literal('pong'),
  ts: z.number().nonnegative()
})

export const ResizeSchema = z.object({
  type: z.literal('resize'),
  cols: z.number().int().positive(),
  rows: z.number().int().positive()
})

export const ScrollSchema = z.object({
  type: z.literal('scroll'),
  lines: z.number().int(),
  atBottom: z.boolean().optional()
})

export const LeaderClaimSchema = z.object({
  type: z.literal('leader-claim'),
  clientId: z.string()
})

export const SetLoggingSchema = z.object({
  type: z.literal('set-logging'),
  enabled: z.boolean()
})

export const AckSchema = z.object({
  type: z.literal('ack'),
  upToSeq: z.number().int().nonnegative()
})

export const InputSchema = z.object({
  type: z.literal('input'),
  dataBase64: z.string()
})

export const ClientControlMessageSchema = z.union([
  HelloSchema,
  JoinSchema,
  PingSchema,
  PongSchema,
  ResizeSchema,
  ScrollSchema,
  LeaderClaimSchema,
  SetLoggingSchema,
  AckSchema,
  InputSchema
])

export type ClientControlMessage = z.infer<typeof ClientControlMessageSchema>

export const OkSchema = z.object({
  type: z.literal('ok'),
  features: z.array(z.string())
})

export const ErrorSchema = z.object({
  type: z.literal('error'),
  code: z.string().default('BAD_REQUEST'),
  message: z.string(),
  hint: z.string().optional()
})

export const HistoryBeginSchema = z.object({
  type: z.literal('history-begin'),
  bytes: z.number().int().nonnegative()
})

export const HistoryChunkSchema = z.object({
  type: z.literal('history-chunk'),
  seq: z.number().int().positive(),
  dataBase64: z.string()
})

export const HistoryEndSchema = z.object({
  type: z.literal('history-end')
})

export const DataDescriptorSchema = z.object({
  type: z.literal('data'),
  seq: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  source: z.enum(['live', 'history']).optional()
})

export const LeaderChangeSchema = z.object({
  type: z.literal('leader-change'),
  clientId: z.string().nullable()
})

export const PolicySchema = z.object({
  type: z.literal('policy'),
  mode: z.enum(['normal', 'replay-only']),
  reason: z.string().optional()
})

export const ScrollStatusSchema = z.object({
  type: z.literal('scroll-status'),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative()
})

export const WelcomeSchema = z.object({
  type: z.literal('welcome'),
  clientId: z.string()
})

export const ServerControlMessageSchema = z.union([
  OkSchema,
  ErrorSchema,
  PingSchema,
  PongSchema,
  HistoryBeginSchema,
  HistoryChunkSchema,
  HistoryEndSchema,
  DataDescriptorSchema,
  LeaderChangeSchema,
  PolicySchema,
  WelcomeSchema,
  ScrollStatusSchema
])

export type ServerControlMessage = z.infer<typeof ServerControlMessageSchema>
