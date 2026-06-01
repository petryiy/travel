import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeItineraryMapData } from '@/lib/itineraryMap'
import type { Itinerary, Message, TripDetails } from '@/types/travel'

const SYSTEM_PROMPT = `You are an expert travel planning assistant. Your job is to help users plan detailed, personalized travel itineraries.

CRITICAL: You must ALWAYS respond with valid JSON only. No markdown, no prose, no code blocks. Pure JSON.

Response schema:
{
  "message": "Your conversational reply to the user",
  "canvas": {
    "type": "none" | "clarification" | "itinerary",
    "clarification": {
      "question": "A specific question you need answered",
      "suggestions": ["option 1", "option 2", "option 3"]
    } | null,
    "itinerary": {
      "trip": { "destination": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "travelers": 2, "style": "relax|culture|adventure|mixed" },
      "summary": "Brief trip overview",
      "days": [
        {
          "day": 1,
          "date": "YYYY-MM-DD",
          "theme": "Arrival & City Center",
          "activities": [
            {
              "time": "morning|afternoon|evening",
              "title": "Activity name",
              "description": "What to do and why it's great",
              "location": "Venue / neighborhood name",
              "coordinates": { "lat": 0.0, "lng": 0.0 },
              "type": "food|attraction|transport|accommodation|activity"
            }
          ]
        }
      ],
      "tips": ["Practical tip 1", "Practical tip 2"],
      "mapCenter": { "lat": 0.0, "lng": 0.0 },
      "keyLocations": [
        { "name": "Place name", "lat": 0.0, "lng": 0.0, "type": "attraction|food|accommodation", "day": 1, "order": 1, "time": "morning", "title": "Activity title" }
      ]
    } | null
  }
}

Rules:
- Set canvas.type = "clarification" when you need ONE specific piece of information. Include 2-4 suggestion chips.
- Set canvas.type = "itinerary" ONLY when you have enough info to build a complete day-by-day plan with real coordinates.
- If CURRENT_ITINERARY_JSON is provided, act like an itinerary-editing agent. Apply the user's latest instruction to that existing itinerary, preserve unrelated days, and return the full updated itinerary.
- For edits such as "that day", "day 2", "Tuesday", or a date, infer the matching itinerary day when possible. Ask a clarification only if the target day or requested location is genuinely ambiguous.
- When you make an edit, do not return only a diff. Return canvas.type = "itinerary" with the entire updated itinerary.
- Set canvas.type = "none" for general conversation or acknowledgements.
- Coordinates must be accurate real-world lat/lng values.
- Include at least 2-3 activities per day covering morning, afternoon, and evening.
- Keep keyLocations aligned with the itinerary activities so the map can show each day's places.
- Keep "message" friendly and conversational, as if texting a friend.`

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface ChatRequest {
  messages: Message[]
  tripDetails?: TripDetails
  currentItinerary?: Itinerary | null
}

function buildUserPrompt(
  latestMessage: string,
  tripDetails?: TripDetails,
  currentItinerary?: Itinerary | null
) {
  if (!currentItinerary) return latestMessage

  return [
    'CURRENT_ITINERARY_JSON:',
    JSON.stringify(currentItinerary),
    '',
    tripDetails ? `TRIP_DETAILS_JSON: ${JSON.stringify(tripDetails)}` : '',
    '',
    `LATEST_USER_INSTRUCTION: ${latestMessage}`,
    '',
    'Apply the latest instruction to CURRENT_ITINERARY_JSON. Return JSON only, using the required response schema.',
  ].filter(Boolean).join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { messages, tripDetails, currentItinerary }: ChatRequest = await req.json()

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(buildUserPrompt(lastMessage.content, tripDetails, currentItinerary))
    const raw = result.response.text()

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

    const parsed = JSON.parse(cleaned)

    // Merge tripDetails into itinerary if Gemini omitted it, then derive reliable map markers.
    if (parsed.canvas?.type === 'itinerary' && parsed.canvas.itinerary) {
      if (tripDetails) {
        parsed.canvas.itinerary.trip = { ...tripDetails, ...parsed.canvas.itinerary.trip }
      }

      parsed.canvas.itinerary = normalizeItineraryMapData(parsed.canvas.itinerary)
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      {
        message: "Sorry, I ran into an issue. Could you try again?",
        canvas: { type: 'none', clarification: null, itinerary: null },
      },
      { status: 200 }
    )
  }
}
