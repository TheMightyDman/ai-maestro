import { NextResponse } from 'next/server'
import type { Session } from '@/types/session'
import { getAgentBySession } from '@/lib/agent-registry'
import { getGatewayActivity } from '@/lib/gateway'
import { normalizeSessionName, runTmuxCommand } from '@/lib/tmux'

// Force this route to be dynamic (not statically generated at build time)
export const dynamic = 'force-dynamic'

const IS_DEV = process.env.NODE_ENV !== 'production'

export async function GET() {
  const routeStart = Date.now()
  if (IS_DEV) {
    console.info('[sessions] GET start')
  }
  try {
    const listStart = Date.now()
    const listResult = await runTmuxCommand(['list-sessions'], { allowCodes: [1] })
    if (IS_DEV) {
      console.info('[sessions] tmux list-sessions', { durationMs: Date.now() - listStart })
    }
    const rawOutput = listResult.stdout?.trim() ?? ''

    if (!rawOutput) {
      if (IS_DEV) {
        console.info('[sessions] no sessions found', { durationMs: Date.now() - routeStart })
      }
      // No sessions found
      return NextResponse.json({ sessions: [] })
    }

    const activityStart = Date.now()
    const activityMap = await getGatewayActivity()
    if (IS_DEV) {
      console.info('[sessions] gateway activity fetched', {
        durationMs: Date.now() - activityStart,
        sessions: activityMap.size
      })
    }

    // Parse tmux output
    const sessionPromises = rawOutput
      .split('\n')
      .map(async (line) => {
        // Format: "session-name: 1 windows (created Wed Jan 10 14:23:45 2025) (attached)"
        // Or: "session-name: 1 windows (created Wed Jan 10 14:23:45 2025)"
        const match = line.match(/^([^:]+):\s+(\d+)\s+windows?\s+\(created\s+(.+?)\)/)

        if (!match) return null

        const [, rawName, windows, createdStr] = match

        const name = normalizeSessionName(rawName)
        if (!name) {
          return null
        }

        // Parse tmux date format: "Thu Oct  9 12:24:58 2025"
        // Normalize multiple spaces to single space for parsing
        const normalizedDate = createdStr.trim().replace(/\s+/g, ' ')

        // Try to parse the date, fallback to current time if it fails
        let createdAt: string
        try {
          const parsedDate = new Date(normalizedDate)
          createdAt = isNaN(parsedDate.getTime())
            ? new Date().toISOString()
            : parsedDate.toISOString()
        } catch {
          createdAt = new Date().toISOString()
        }

        // Get last activity from global sessionActivity Map (populated by server.mjs)
        let lastActivity: string
        let status: 'active' | 'idle' | 'disconnected'

        const activityTimestamp = activityMap.get(name)

        if (activityTimestamp) {
          lastActivity = new Date(activityTimestamp).toISOString()

          // Calculate if session is idle (no activity for 3+ seconds)
          const secondsSinceActivity = (Date.now() - activityTimestamp) / 1000
          status = secondsSinceActivity > 3 ? 'idle' : 'active'
        } else {
          // No activity data yet - assume disconnected
          lastActivity = createdAt
          status = 'disconnected'
        }

        // Get working directory from tmux (pane_current_path of first pane)
        let workingDirectory = ''
        try {
          const cwdStart = Date.now()
          const cwdResult = await runTmuxCommand(
            ['display-message', '-t', name, '-p', '#{pane_current_path}'],
            { allowCodes: [1], timeoutMs: 2000 }
          )
          workingDirectory = cwdResult.stdout?.trim() ?? ''
          if (IS_DEV) {
            console.info('[sessions] cwd fetched', {
              session: name,
              hasCwd: Boolean(workingDirectory),
              durationMs: Date.now() - cwdStart
            })
          }
        } catch {
          // If we can't get it, leave empty
          workingDirectory = ''
          if (IS_DEV) {
            console.warn('[sessions] cwd fetch failed', { session: name })
          }
        }

        // Check if this session is linked to an agent
        const agent = getAgentBySession(name)

        return {
          id: name,
          name,
          workingDirectory,
          status,
          createdAt,
          lastActivity,
          windows: parseInt(windows, 10),
          ...(agent && { agentId: agent.id })
        }
      })

    const sessions = (await Promise.all(sessionPromises))
      .filter(session => session !== null) as Session[]

    if (IS_DEV) {
      console.info('[sessions] success', {
        totalSessions: sessions.length,
        durationMs: Date.now() - routeStart
      })
    }
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions', sessions: [] },
      { status: 500 }
    )
  }
}
