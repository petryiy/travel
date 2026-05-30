import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { createDemoItinerary } from '@/lib/planner/demoItinerary'
import { optimizeItinerary } from '@/lib/planner/scheduler'
import type { GeminiResponse, Message, TripDetails } from '@/types/travel'

const SYSTEM_PROMPT = `You are AtlasLoop, an expert AI travel planning assistant for consumers.

You must respond with valid JSON only. Do not use markdown, prose outside JSON, code fences, or comments.

Response schema:
{
  "message": "A concise conversational reply in English",
  "canvas": {
    "type": "none" | "clarification" | "itinerary",
    "clarification": {
      "question": "One specific question that improves the plan",
      "suggestions": ["short option", "short option", "short option"]
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
        "homeBase": "optional neighborhood or hotel area"
      },
      "summary": "Brief value-focused overview",
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
- Ask for clarification only when a missing detail would materially change the trip.
- Build a complete itinerary when destination, dates, traveler count, pace, budget, style, and transport are known.
- Use accurate real-world coordinates for each activity.
- Include 3 to 5 activities per day.
- Keep the plan realistic for the user's selected pace and transport mode.
- Do not include non-English text.`

function cleanJson(text: string) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
}

function demoResponse(tripDetails?: TripDetails): GeminiResponse {
  if (!tripDetails) {
    return {
      message: 'Tell me your destination, dates, budget, pace, and preferred transport so I can build the plan.',
      canvas: {
        type: 'clarification',
        clarification: {
          question: 'What destination should I plan for?',
          suggestions: ['Tokyo', 'Sydney', 'Paris'],
        },
        itinerary: null,
      },
    }
  }

  return {
    message: 'I created a route-aware starter itinerary with realistic buffers and feasibility checks.',
    canvas: {
      type: 'itinerary',
      clarification: null,
      itinerary: createDemoItinerary(tripDetails),
    },
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, tripDetails }: { messages: Message[]; tripDetails?: TripDetails } = await req.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(demoResponse(tripDetails))
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

    if (parsed.canvas.type === 'itinerary' && parsed.canvas.itinerary && tripDetails) {
      const mergedTrip = { ...tripDetails, ...parsed.canvas.itinerary.trip }
      parsed.canvas.itinerary = optimizeItinerary(
        {
          ...parsed.canvas.itinerary,
          trip: mergedTrip,
        },
        mergedTrip
      )
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(demoResponse())
  }
}
