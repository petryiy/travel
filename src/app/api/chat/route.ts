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
- If CURRENT_ITINERARY_JSON is provided, act like an itinerary-editing agent. Apply the user's latest instruction to that existing itinerary, preserve unrelated days, and return the full updated itinerary.
- For edits such as "that day", "day 2", "Tuesday", a clock time, or a date, infer the matching itinerary day when possible. Ask a clarification only if the target day, requested location, or fixed appointment time is genuinely ambiguous.
- When you make an edit, do not return only a diff. Return canvas.type = "itinerary" with the entire updated itinerary.
- Set canvas.type = "none" for general conversation or acknowledgements.
- Coordinates must be accurate real-world lat/lng values.
- Create a concrete chronological timeline, not vague blocks. Every activity must include startTime, endTime, durationMinutes, and a time period.
- Treat trip.dailyStartTime as the earliest normal departure time and trip.dailyEndTime as the latest normal return time. They are availability bounds, not a requirement to fill the full day.
- Set each day's startTime and endTime to the actual planned first departure and final return/finish time. It is fine for a day to start later or end earlier when that is more realistic.
- Choose the number of activities naturally based on the destination, travel time, opening hours, fatigue, and the user's style. There is no minimum or maximum activity count.
- Use realistic visit durations. Do not stretch a viewpoint, shop, landmark, meal, or short experience just to fill morning/afternoon/evening.
- Leave open time, rest time, or an early finish when appropriate. Do not invent filler stops or pad durations to fill gaps.
- Include travelFromPrevious for every activity after the first meaningful stop of the day. Its duration should fit in the gap between the previous activity's endTime and this activity's startTime.
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
    'Preserve fixed-time activities unless the user explicitly changes them. Recalculate start/end times and travelFromPrevious for the affected day.',
    'Keep durations realistic after edits. Do not pad activities or add filler stops just to fill the available day window.',
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
