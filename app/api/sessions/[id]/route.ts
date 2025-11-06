import { NextResponse } from 'next/server'
import { unpersistSession } from '@/lib/session-persistence'
import { normalizeSessionName, runTmuxCommand } from '@/lib/tmux'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawSessionName } = await params

    const sessionName = normalizeSessionName(rawSessionName)

    if (!sessionName) {
      return NextResponse.json(
        { error: 'Invalid session name' },
        { status: 400 }
      )
    }

    // Check if session exists
    const existingCheck = await runTmuxCommand(['has-session', '-t', sessionName], { allowCodes: [1] })

    if (existingCheck.code === 1) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Kill the tmux session
    await runTmuxCommand(['kill-session', '-t', sessionName])

    // Remove from persistence
    unpersistSession(sessionName)

    return NextResponse.json({ success: true, name: sessionName })
  } catch (error) {
    console.error('Failed to delete session:', error)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
}
