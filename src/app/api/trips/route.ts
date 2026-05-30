import { NextRequest, NextResponse } from 'next/server'
import { isDynamoConfigured, listTripSnapshots, saveTripSnapshot } from '@/lib/aws/dynamodb'
import type { Itinerary } from '@/types/travel'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ records: [], configured: isDynamoConfigured() })
  }

  if (!isDynamoConfigured()) {
    return NextResponse.json({ records: [], configured: false })
  }

  try {
    const records = await listTripSnapshots(sessionId)
    return NextResponse.json({ records, configured: true })
  } catch (error) {
    console.error('Trip list failed:', error)
    return NextResponse.json({ records: [], configured: true, error: 'Unable to read saved trips.' }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { sessionId?: string; itinerary?: Itinerary }
  if (!body.sessionId || !body.itinerary) {
    return NextResponse.json({ saved: false, configured: isDynamoConfigured(), error: 'Missing trip data.' }, { status: 400 })
  }

  if (!isDynamoConfigured()) {
    return NextResponse.json({
      saved: false,
      configured: false,
      message: 'DynamoDB is not configured in this environment.',
    })
  }

  try {
    const record = await saveTripSnapshot(body.sessionId, body.itinerary)
    return NextResponse.json({ saved: true, configured: true, record })
  } catch (error) {
    console.error('Trip save failed:', error)
    return NextResponse.json(
      { saved: false, configured: true, error: 'Unable to save this trip to DynamoDB.' },
      { status: 200 }
    )
  }
}
