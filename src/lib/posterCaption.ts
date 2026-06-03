import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Itinerary } from '@/types/travel'

const FALLBACK_CAPTION = 'Let the day unfold gently, one beautiful stop at a time.'

export function fallbackPosterCaption(itinerary?: Itinerary) {
  if (!itinerary) return FALLBACK_CAPTION
  return `A softer way to meet ${itinerary.trip.destination}, one gentle moment at a time.`
}

export function cleanPosterCaption(value: string, itinerary?: Itinerary) {
  const caption = value
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!caption) return fallbackPosterCaption(itinerary)
  if (caption.length <= 120) return caption

  return `${caption.slice(0, 117).trim()}...`
}

export async function createPosterCaption(itinerary: Itinerary, title?: string) {
  try {
    const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!).getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    })

    const themes = itinerary.days.map((day) => `Day ${day.day}: ${day.theme}`).join('\n')
    const highlights = itinerary.days
      .flatMap((day) => day.activities.slice(0, 3).map((activity) => activity.title))
      .slice(0, 10)
      .join(', ')

    const result = await model.generateContent([
      'Write exactly one short healing travel-poster sentence in warm English.',
      'Style: poetic but natural, calm, not cheesy, under 18 words.',
      'No markdown. No quotes. No emoji.',
      `Poster title: ${title ?? itinerary.trip.destination}`,
      `Destination: ${itinerary.trip.destination}`,
      `Trip style: ${itinerary.trip.style}`,
      `Day themes:\n${themes}`,
      `Highlights: ${highlights}`,
    ].join('\n'))

    return cleanPosterCaption(result.response.text(), itinerary)
  } catch (err) {
    console.error('Poster caption generation error:', err)
    return fallbackPosterCaption(itinerary)
  }
}
