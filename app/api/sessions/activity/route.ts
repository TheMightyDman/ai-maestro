import { NextResponse } from 'next/server'
import { getGatewayActivity } from '@/lib/gateway'

export async function GET() {
  try {
    const activityMap = await getGatewayActivity()
    const activity: Record<string, { lastActivity: string; status: 'active' | 'idle' }> = {}

    const now = Date.now()
    activityMap.forEach((timestamp, sessionName) => {
      const secondsSinceActivity = (now - timestamp) / 1000
      activity[sessionName] = {
        lastActivity: new Date(timestamp).toISOString(),
        status: secondsSinceActivity > 3 ? 'idle' : 'active'
      }
    })

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('Failed to fetch activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity', activity: {} },
      { status: 500 }
    )
  }
}
