import { NextRequest, NextResponse } from 'next/server'
import { createPosterCaption, fallbackPosterCaption } from '@/lib/posterCaption'
import type { Itinerary } from '@/types/travel'

interface PosterCaptionRequest {
  title?: string
  itinerary?: Itinerary
}

export async function POST(req: NextRequest) {
  try {
    const { title, itinerary }: PosterCaptionRequest = await req.json()
    if (!itinerary) {
      return NextResponse.json({ caption: fallbackPosterCaption() })
    }

    return NextResponse.json({ caption: await createPosterCaption(itinerary, title) })
  } catch (err) {
    console.error('Poster caption error:', err)
    return NextResponse.json({ caption: fallbackPosterCaption() })
  }
}
