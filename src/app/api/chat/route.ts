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
      "trip": { "destination": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "travelers": 2, "style": "relax|culture|adventure|mixed", "dailyStartTime": "09:00", "dailyEndTime": "21:00" },
      "summary": "Brief trip overview",
      "days": [
        {
          "day": 1,
          "date": "YYYY-MM-DD",
          "theme": "Arrival & City Center",
          "startTime": "09:15",
          "endTime": "17:30",
          "activities": [
            {
              "time": "morning|afternoon|evening",
              "startTime": "09:30",
              "endTime": "11:00",
              "durationMinutes": 90,
              "travelFromPrevious": { "mode": "transit|walk|taxi|rideshare|train|bus|ferry|flight|other", "durationMinutes": 25, "description": "25 min by metro from the previous stop" } | null,
              "isFixedTime": false,
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
        { "name": "Place name", "lat": 0.0, "lng": 0.0, "type": "attraction|food|accommodation", "day": 1, "order": 1, "time": "morning", "startTime": "09:30", "endTime": "11:00", "title": "Activity title" }
      ]
    } | null
  }
}

Rules:
- Set canvas.type = "clarification" when you need ONE specific piece of information. Include 2-4 suggestion chips.
- Set canvas.type = "itinerary" ONLY when you have enough info to build a complete day-by-day plan with real coordinates.
- If CURRENT_ITINERARY_JSON is provided, act like an itinerary-editing agent. Apply the user's latest instruction to that existing itinerary, preserve truly unrelated days, and return the full updated itinerary.
- Before adding a new activity, check whether the same or semantically equivalent attraction, venue, restaurant, show, tour, reservation, or transit item already exists anywhere in the itinerary. If it does, update or move the existing activity instead of creating a duplicate.
- If the user says they booked/reserved an activity for a different day or time and that activity already appears elsewhere, treat it as a reschedule: remove the old instance, place it at the booked day/time, mark it isFixedTime = true, and repair the affected days' timelines.
- Do not schedule the same named tour, venue, or ticketed experience on multiple days unless the user explicitly asks to do it twice.
- For edits such as "that day", "day 2", "Tuesday", a clock time, or a date, infer the matching itinerary day when possible. Ask a clarification only if the target day, requested location, or fixed appointment time is genuinely ambiguous.
- When you make an edit, do not return only a diff. Return canvas.type = "itinerary" with the entire updated itinerary.
- Set canvas.type = "none" for general conversation or acknowledgements.
- Coordinates must be accurate real-world lat/lng values.
- Create a concrete chronological timeline, not vague blocks. Every activity must include startTime, endTime, durationMinutes, and a time period.
- Treat trip.dailyStartTime and trip.dailyEndTime as the user's normal planning window for the day. Build a complete, well-paced day inside that window.
- Choose activities and durations based on real-world visit length, opening hours, transit, meals, and the user's travel style.
- If a stop is short, schedule it as short and continue with the next sensible part of the day instead of stretching it.
- Include travelFromPrevious for every activity after the first meaningful stop of the day.
- Avoid impossible overlaps. Leave small buffers for meals, queues, check-in, and transit.
- If the user mentions a booking, reservation, ticket, flight, train, meeting, or "I have an activity at 14:00", mark that activity isFixedTime = true and rearrange the rest of that day around it.
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
  if (!currentItinerary) {
    return [
      latestMessage,
      '',
      tripDetails ? `TRIP_DETAILS_JSON: ${JSON.stringify(tripDetails)}` : '',
      '',
      'Use these trip details to create the itinerary. Return JSON only, using the required response schema.',
    ].filter(Boolean).join('\n')
  }

  return [
    'CURRENT_ITINERARY_JSON:',
    JSON.stringify(currentItinerary),
    '',
    tripDetails ? `TRIP_DETAILS_JSON: ${JSON.stringify(tripDetails)}` : '',
    '',
    `LATEST_USER_INSTRUCTION: ${latestMessage}`,
    '',
    'Apply the latest instruction to CURRENT_ITINERARY_JSON. Return JSON only, using the required response schema.',
    'First identify whether the user is referring to an activity already present in CURRENT_ITINERARY_JSON, including close title/location matches. If yes, move or update that activity instead of adding another copy.',
    'If an activity moves from one day to another, remove the old instance and rebalance both the source day and destination day.',
    'Preserve fixed-time activities unless the user explicitly changes them. Recalculate start/end times and travelFromPrevious for the affected day.',
    'Keep the revised day complete and well-paced inside the user’s planning window.',
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
