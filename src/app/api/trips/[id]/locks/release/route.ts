import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'

// POST endpoint usable by navigator.sendBeacon on page unload (beacon can only
// POST). Releases all locks and presence the user holds on this trip.
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const userId = session.user.id

  const client = await getClient()
  try {
    await client.query('DELETE FROM trip_locks WHERE trip_id = $1 AND user_id = $2', [id, userId])
    try {
      await client.query('DELETE FROM trip_presence WHERE trip_id = $1 AND user_id = $2', [id, userId])
    } catch {
      // presence table is best-effort
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Beacon release error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  } finally {
    await client.end()
  }
}
