import { NextResponse } from 'next/server'
import { normalizeSessionName, runTmuxCommand } from '@/lib/tmux'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { newName } = await request.json()
    const { id: rawOldName } = await params

    if (typeof newName !== 'string' || newName.trim().length === 0) {
      return NextResponse.json({ error: 'New session name is required' }, { status: 400 })
    }

    const oldName = normalizeSessionName(rawOldName)
    if (!oldName) {
      return NextResponse.json({ error: 'Invalid session name' }, { status: 400 })
    }

    const normalizedNewName = normalizeSessionName(newName)
    if (!normalizedNewName) {
      return NextResponse.json(
        { error: 'Session name can only contain letters, numbers, dashes, and underscores' },
        { status: 400 }
      )
    }

    // Check if old session exists
    const existingCheck = await runTmuxCommand(['has-session', '-t', oldName], { allowCodes: [1] })

    if (existingCheck.code === 1) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if new name is already taken
    const newNameCheck = await runTmuxCommand(['has-session', '-t', normalizedNewName], { allowCodes: [1] })

    if (newNameCheck.code === 0) {
      return NextResponse.json({ error: 'Session name already exists' }, { status: 409 })
    }

    // Rename the session
    await runTmuxCommand(['rename-session', '-t', oldName, normalizedNewName])

    return NextResponse.json({ success: true, oldName, newName: normalizedNewName })
  } catch (error) {
    console.error('Failed to rename session:', error)
    return NextResponse.json({ error: 'Failed to rename session' }, { status: 500 })
  }
}
