import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { createDemoItinerary } from '@/lib/planner/demoItinerary'
import { optimizeItinerary } from '@/lib/planner/scheduler'
import type { GeminiResponse, LocationFocus, Message, TripDetails } from '@/types/travel'

const SYSTEM_PROMPT = `You are AtlasLoop, a cinematic AI travel operations assistant.

The website UI must stay in English. You must respond with valid JSON only. Do not use markdown, code fences, comments, or prose outside JSON.

Your job is to interview the traveler naturally, one question at a time, then generate a route-aware itinerary.

Required details before itinerary:
- destination
- dates
- traveler count
- trip style
- pace
- budget
- preferred transport
- home base or lodging area

Response schema:
{
  "message": "A concise conversational reply in English",
  "canvas": {
    "type": "none" | "clarification" | "itinerary",
    "clarification": {
      "question": "One specific question that moves the planning forward",
      "suggestions": ["short option", "short option", "short option"]
    } | null,
    "locationFocus": {
      "name": "Place or lodging area",
      "label": "Home base locked",
      "coordinates": { "lat": 0, "lng": 0 },
      "confidence": "exact|estimated"
    } | null,
    "itinerary": {
      "trip": {
        "destination": "string",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "travelers": 2,
        "style": "relaxed|culture|adventure|food|mixed",
        "pace": "easy|balanced|packed",
        "budget": "lean|balanced|premium",
        "transport": "walking|transit|driving",
        "homeBase": "neighborhood or hotel area"
      },
      "summary": "Brief cinematic but practical trip overview",
      "feasibilityScore": 80,
      "mapCenter": { "lat": 0, "lng": 0 },
      "keyLocations": [],
      "days": [
        {
          "day": 1,
          "date": "YYYY-MM-DD",
          "theme": "Day theme",
          "summary": "Why this day works",
          "activities": [
            {
              "period": "morning|midday|afternoon|evening",
              "title": "Activity name",
              "description": "What the traveler should do and why it fits",
              "location": "Venue, district, or landmark",
              "coordinates": { "lat": 0, "lng": 0 },
              "category": "food|attraction|transport|accommodation|activity|shopping|nightlife",
              "durationMinutes": 75,
              "estimatedCost": 25,
              "bookingHint": "Optional booking note",
              "priority": 1
            }
          ],
          "route": [],
          "feasibility": {
            "score": 0,
            "totalActivityMinutes": 0,
            "totalTravelMinutes": 0,
            "tightStops": 0,
            "summary": ""
          }
        }
      ],
      "tips": ["Practical tip", "Practical tip"]
    } | null
  }
}

Rules:
- Ask only one question at a time.
- If the user gives their hotel, district, or home base, include locationFocus with real coordinates.
- Generate itinerary only after all required details are known.
- Use accurate real-world coordinates.
- Include 3 to 5 activities per day.
- Keep the plan realistic for pace and transport.
- Do not include non-English text.`

const KNOWN_LOCATIONS: Record<string, LocationFocus> = {
  'circular quay': {
    name: 'Circular Quay',
    label: 'Home base locked',
    coordinates: { lat: -33.8611, lng: 151.2131 },
    confidence: 'estimated',
  },
  'surry hills': {
    name: 'Surry Hills',
    label: 'Home base locked',
    coordinates: { lat: -33.8846, lng: 151.212 },
    confidence: 'estimated',
  },
  shinjuku: {
    name: 'Shinjuku',
    label: 'Home base locked',
    coordinates: { lat: 35.6938, lng: 139.7034 },
    confidence: 'estimated',
  },
  shibuya: {
    name: 'Shibuya',
    label: 'Home base locked',
    coordinates: { lat: 35.6595, lng: 139.7005 },
    confidence: 'estimated',
  },
  'latin quarter': {
    name: 'Latin Quarter',
    label: 'Home base locked',
    coordinates: { lat: 48.8493, lng: 2.3446 },
    confidence: 'estimated',
  },
}

function cleanJson(text: string) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
}

function lastUserMessage(messages: Message[]) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
}

function lastAssistantMessage(messages: Message[]) {
  return [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? ''
}

function detectDestination(text: string) {
  const known = ['Sydney', 'Tokyo', 'Paris', 'New York', 'London', 'Seoul', 'Singapore', 'Bali']
  return known.find((city) => text.toLowerCase().includes(city.toLowerCase()))
}

function detectDates(text: string) {
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g) ?? []
  return { startDate: dates[0], endDate: dates[1] }
}

function detectTravelers(text: string) {
  const match = text.match(/(\d+)\s*(traveler|travelers|people|person|pax)/i)
  return match ? Number(match[1]) : undefined
}

function detectStyle(text: string): TripDetails['style'] | undefined {
  const lower = text.toLowerCase()
  if (lower.includes('food')) return 'food'
  if (lower.includes('culture') || lower.includes('museum') || lower.includes('history')) return 'culture'
  if (lower.includes('adventure') || lower.includes('outdoor') || lower.includes('hike')) return 'adventure'
  if (lower.includes('relax') || lower.includes('slow')) return 'relaxed'
  if (lower.includes('mixed') || lower.includes('balanced')) return 'mixed'
  return undefined
}

function detectPace(text: string): TripDetails['pace'] | undefined {
  const lower = text.toLowerCase()
  if (lower.includes('easy') || lower.includes('slow')) return 'easy'
  if (lower.includes('packed') || lower.includes('dense')) return 'packed'
  if (lower.includes('balanced')) return 'balanced'
  return undefined
}

function detectBudget(text: string): TripDetails['budget'] | undefined {
  const lower = text.toLowerCase()
  if (lower.includes('lean') || lower.includes('cheap') || lower.includes('budget')) return 'lean'
  if (lower.includes('premium') || lower.includes('luxury')) return 'premium'
  if (lower.includes('balanced') || lower.includes('medium')) return 'balanced'
  return undefined
}

function detectTransport(text: string): TripDetails['transport'] | undefined {
  const lower = text.toLowerCase()
  if (lower.includes('walk')) return 'walking'
  if (lower.includes('drive') || lower.includes('car')) return 'driving'
  if (lower.includes('transit') || lower.includes('train') || lower.includes('metro') || lower.includes('bus')) return 'transit'
  return undefined
}

function detectLocationFocus(text: string, previousAssistant: string): LocationFocus | undefined {
  const lower = text.toLowerCase()
  const direct = Object.entries(KNOWN_LOCATIONS).find(([key]) => lower.includes(key))?.[1]
  if (direct) return direct

  if (/stay|staying|home base|hotel|base/i.test(previousAssistant) && text.trim()) {
    return {
      name: text.trim().slice(0, 70),
      label: 'Home base locked',
      coordinates: { lat: -33.8688, lng: 151.2093 },
      confidence: 'estimated',
    }
  }

  return undefined
}

function collectTripDetails(messages: Message[]): { details: Partial<TripDetails>; locationFocus?: LocationFocus } {
  const text = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ')
  const previousAssistant = lastAssistantMessage(messages)
  const knownLocation = Object.entries(KNOWN_LOCATIONS).find(([key]) => text.toLowerCase().includes(key))?.[1]
  const locationFocus = detectLocationFocus(lastUserMessage(messages), previousAssistant) ?? knownLocation
  const dates = detectDates(text)

  return {
    locationFocus,
    details: {
      destination: detectDestination(text),
      startDate: dates.startDate,
      endDate: dates.endDate,
      travelers: detectTravelers(text),
      style: detectStyle(text),
      pace: detectPace(text),
      budget: detectBudget(text),
      transport: detectTransport(text),
      homeBase: locationFocus?.name,
    },
  }
}

function nextClarification(details: Partial<TripDetails>) {
  if (!details.destination) {
    return {
      question: 'Where should I plot the trip?',
      suggestions: ['Sydney', 'Tokyo', 'Paris'],
    }
  }

  if (!details.startDate || !details.endDate) {
    return {
      question: 'What dates should I plan around?',
      suggestions: ['2026-06-12 to 2026-06-14', '2026-07-03 to 2026-07-07', '2026-09-18 to 2026-09-21'],
    }
  }

  if (!details.travelers) {
    return {
      question: 'How many travelers are in the group?',
      suggestions: ['1 traveler', '2 travelers', '4 travelers'],
    }
  }

  if (!details.style || !details.pace || !details.budget || !details.transport) {
    return {
      question: 'What planning profile should I use?',
      suggestions: ['mixed, balanced pace, balanced budget, transit', 'food, easy pace, premium budget, walking', 'culture, packed pace, lean budget, transit'],
    }
  }

  if (!details.homeBase) {
    return {
      question: 'Where will you be staying, or what area should I use as your home base?',
      suggestions: ['Circular Quay', 'Shinjuku', 'Latin Quarter'],
    }
  }

  return null
}

function completeDetails(details: Partial<TripDetails>): TripDetails {
  return {
    destination: details.destination ?? 'Sydney',
    startDate: details.startDate ?? '2026-06-12',
    endDate: details.endDate ?? details.startDate ?? '2026-06-14',
    travelers: details.travelers ?? 2,
    style: details.style ?? 'mixed',
    pace: details.pace ?? 'balanced',
    budget: details.budget ?? 'balanced',
    transport: details.transport ?? 'transit',
    homeBase: details.homeBase,
  }
}

function fallbackResponse(messages: Message[]): GeminiResponse {
  const { details, locationFocus } = collectTripDetails(messages)
  const clarification = nextClarification(details)

  if (clarification) {
    return {
      message: locationFocus
        ? `${locationFocus.name} is locked as the home base. I am calibrating the route grid now.`
        : clarification.question,
      canvas: {
        type: 'clarification',
        clarification,
        locationFocus: locationFocus ?? null,
        itinerary: null,
      },
    }
  }

  const trip = completeDetails(details)
  const itinerary = createDemoItinerary(trip)

  return {
    message: 'Route grid compiled. I generated a feasible itinerary with timed stops and pressure checks.',
    canvas: {
      type: 'itinerary',
      clarification: null,
      locationFocus: locationFocus ?? null,
      itinerary,
    },
  }
}

export async function POST(req: NextRequest) {
  let requestMessages: Message[] = []
  try {
    const { messages }: { messages: Message[] } = await req.json()
    requestMessages = messages

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(fallbackResponse(requestMessages))
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const history = messages.slice(0, -1).map((message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }))

    const lastMessage = messages[messages.length - 1]
    const chat = model.startChat({ history })
    const result = await chat.sendMessage(lastMessage.content)
    const parsed = JSON.parse(cleanJson(result.response.text())) as GeminiResponse

    if (parsed.canvas.type === 'itinerary' && parsed.canvas.itinerary) {
      const trip = completeDetails(parsed.canvas.itinerary.trip)
      parsed.canvas.itinerary = optimizeItinerary(
        {
          ...parsed.canvas.itinerary,
          trip,
        },
        trip
      )
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(fallbackResponse(requestMessages))
  }
}
