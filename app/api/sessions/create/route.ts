import { NextResponse } from 'next/server'
import { persistSession } from '@/lib/session-persistence'
import { normalizeSessionName, runTmuxCommand } from '@/lib/tmux'

export async function POST(request: Request) {
  try {
    const { name, workingDirectory, agentId } = await request.json()

    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Session name is required' }, { status: 400 })
    }

    const sessionName = normalizeSessionName(name)

    if (!sessionName) {
      return NextResponse.json(
        { error: 'Session name can only contain letters, numbers, dashes, and underscores' },
        { status: 400 }
      )
    }

    const hasSessionResult = await runTmuxCommand(['has-session', '-t', sessionName], { allowCodes: [1] })

    if (hasSessionResult.code === 0) {
      return NextResponse.json({ error: 'Session already exists' }, { status: 409 })
    }

    // Create new tmux session
    // Default to current working directory if not specified
    const cwd = typeof workingDirectory === 'string' && workingDirectory.trim().length > 0
      ? workingDirectory
      : process.cwd()

    await runTmuxCommand(['new-session', '-d', '-s', sessionName, '-c', cwd])

    // Persist session metadata
    persistSession({
      id: sessionName,
      name: sessionName,
      workingDirectory: cwd,
      createdAt: new Date().toISOString(),
      ...(agentId && { agentId })
    })

    return NextResponse.json({ success: true, name: sessionName })
  } catch (error) {
    console.error('Failed to create session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
