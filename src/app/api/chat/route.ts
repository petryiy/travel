import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeItineraryMapData } from '@/lib/itineraryMap'
import { getInclusiveTripDates } from '@/lib/tripDates'
import type { GeminiResponse, Itinerary, Message, TripDetails } from '@/types/travel'

const INITIAL_GENERATION_CHUNK_DAYS = 7

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
      "trip": { "destination": "...", "accommodationLocation": "Hotel / neighborhood / address or null", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "travelers": 2, "style": "relax|culture|adventure|mixed", "dailyStartTime": "09:00", "dailyEndTime": "21:00" },
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
              "travelFromPrevious": { "mode": "transit|walk|taxi|rideshare|train|light_rail|bus|ferry|flight|other", "durationMinutes": 25, "description": "25 min by metro from the previous stop", "routeName": "T4 / Bus 333 / L2", "cost": "Approx. $4", "recommended": true } | null,
              "travelOptions": [
                { "mode": "transit|walk|taxi|rideshare|train|light_rail|bus|ferry|flight|other", "durationMinutes": 25, "description": "Take L2 light rail to Circular Quay, then walk 6 min", "routeName": "L2 + walk", "cost": "Approx. $4", "recommended": true }
              ] | null,
              "isFixedTime": false,
              "title": "Activity name",
              "description": "Detailed right-panel note: what to do here, which highlights to prioritize, and why this duration is appropriate",
              "location": "Venue / neighborhood name",
              "coordinates": { "lat": 0.0, "lng": 0.0 },
              "type": "food|attraction|transport|accommodation|activity",
              "hoursNote": "Open Mon–Sat 09:00–18:00, closed Sun" | null,
              "hoursWarning": "Scheduled at 08:30 but venue opens at 09:00" | null
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
- If trip.accommodationLocation is provided, use it as the home base for each day. Plan the first travel leg from that area/place and end the day with a realistic route back toward it.
- Choose activities and durations based on real-world visit length, opening hours, transit, meals, and the user's travel style.
- Use realistic visit lengths. Do not stretch a museum/gallery/single landmark to 3 hours unless it is genuinely a deep visit and the description explains how that time will be used. Typical focused museum/gallery stops are often 75-120 minutes; quick viewpoints or photo stops can be 20-45 minutes; meals are often 45-90 minutes; beach/coastal neighborhoods can be 120-180 minutes only when the plan includes walking, relaxing, food, or multiple nearby points.
- Do not make a full day feel sparse by scheduling only 2-3 oversized activities unless the user explicitly wants a slow day, the destination is remote, or travel/appointments truly consume the day. Use as many or as few stops as are naturally needed, but prefer adding nearby short stops over inflating one venue's duration.
- Each activity.description is for the Details panel, not the timeline card. Write 2-4 specific sentences that explain: what the traveler should do there, why the allocated duration makes sense, and how to shorten or deepen the stop if relevant.
- If a stop is short, schedule it as short and continue with the next sensible part of the day instead of stretching it.
- Include travelFromPrevious for every activity after the first meaningful stop of the day.
- Also include travelOptions for every activity after the first meaningful stop of the day: 1-3 practical ways to get there, ordered by recommendation. Prefer walk/public transport when sensible, do not default to taxi, and include known route names or line numbers such as L2, T4, bus 333, ferry F1 when you can do so confidently. Set travelFromPrevious equal to the best recommended option.
- Travel time must be counted between stops. For every activity after the first stop, ensure previousActivity.endTime + travelFromPrevious.durationMinutes + a small realistic buffer is less than or equal to this activity.startTime.
- The activity's startTime is when the traveler arrives and starts doing that activity, not when they leave the previous stop. Do not hide transit inside the activity duration.
- Avoid impossible overlaps. Leave small buffers for meals, queues, check-in, and transit.
- If the user mentions a booking, reservation, ticket, flight, train, meeting, or "I have an activity at 14:00", mark that activity isFixedTime = true and rearrange the rest of that day around it.
- Keep keyLocations aligned with the itinerary activities so the map can show each day's places.
- For each activity, if you know the venue's typical opening hours, set hoursNote to a concise human-readable string (e.g. "Open Mon–Sat 09:00–18:00"). If the planned startTime falls outside those known hours, set hoursWarning to a short explanation (e.g. "Scheduled at 08:30 but opens at 09:00"). Leave both null if you are not confident about the hours.
- Keep "message" friendly and conversational, as if texting a friend.`

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface ChatRequest {
  messages: Message[]
  tripDetails?: TripDetails
  currentItinerary?: Itinerary | null
}

const BOOKING_OR_MOVE_RE = /\b(booked|booking|reserved|reservation|ticket|tickets|slot|appointment|move|moved|reschedule|rescheduled|change|changed)\b/i
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'have',
  'booked',
  'booking',
  'reserved',
  'reservation',
  'ticket',
  'tickets',
  'slot',
  'appointment',
  'move',
  'moved',
  'reschedule',
  'rescheduled',
  'change',
  'changed',
  'day',
  'pm',
  'am',
])

function getTargetDay(text: string) {
  const englishMatch = text.match(/\bday\s*(\d+)\b/i)
  if (englishMatch) return Number(englishMatch[1])

  const chineseMatch = text.match(/第\s*(\d+)\s*天/)
  if (chineseMatch) return Number(chineseMatch[1])

  return null
}

function significantTokens(text: string) {
  return Array.from(new Set(
    text
      .toLowerCase()
      .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)?\b/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  ))
}

function activityTokens(activity: Itinerary['days'][number]['activities'][number]) {
  return significantTokens(`${activity.title} ${activity.location}`)
}

function overlapScore(sourceTokens: string[], targetTokens: string[]) {
  if (sourceTokens.length === 0 || targetTokens.length === 0) return { overlap: 0, score: 0 }

  const source = new Set(sourceTokens)
  const overlap = targetTokens.filter((token) => source.has(token)).length

  return {
    overlap,
    score: overlap / Math.min(sourceTokens.length, targetTokens.length),
  }
}

function findBestMatchingActivityIndex(
  activities: Itinerary['days'][number]['activities'],
  queryTokens: string[]
) {
  let bestIndex = -1
  let bestScore = 0

  activities.forEach((activity, index) => {
    const { overlap, score } = overlapScore(activityTokens(activity), queryTokens)
    if (overlap >= 2 && score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  })

  return bestScore >= 0.5 ? bestIndex : -1
}

function isSameActivity(
  activity: Itinerary['days'][number]['activities'][number],
  referenceTokens: string[]
) {
  const { overlap, score } = overlapScore(activityTokens(activity), referenceTokens)
  return overlap >= 2 && score >= 0.6
}

function removeDuplicateBookedActivity(itinerary: Itinerary, latestMessage: string) {
  if (!BOOKING_OR_MOVE_RE.test(latestMessage)) return itinerary

  const targetDayNumber = getTargetDay(latestMessage)
  if (!targetDayNumber) return itinerary

  const targetDay = itinerary.days.find((day) => day.day === targetDayNumber)
  if (!targetDay) return itinerary

  const queryTokens = significantTokens(latestMessage)
  if (queryTokens.length < 2) return itinerary

  const targetActivityIndex = findBestMatchingActivityIndex(targetDay.activities, queryTokens)
  if (targetActivityIndex < 0) return itinerary

  const referenceTokens = activityTokens(targetDay.activities[targetActivityIndex])

  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      let removedBeforeNextActivity = false

      return {
        ...day,
        activities: day.activities.flatMap((activity, index) => {
          const shouldKeepTarget = day.day === targetDayNumber && index === targetActivityIndex
          const shouldRemoveDuplicate = !shouldKeepTarget && isSameActivity(activity, referenceTokens)

          if (shouldRemoveDuplicate) {
            removedBeforeNextActivity = true
            return []
          }

          if (removedBeforeNextActivity) {
            removedBeforeNextActivity = false
            return [{ ...activity, travelFromPrevious: null }]
          }

          return [activity]
        }),
      }
    }),
  }
}

function stripMarkdownFences(text: string) {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf('{')
  if (start < 0) throw new SyntaxError('No JSON object found in model response')

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  throw new SyntaxError('Unterminated JSON object in model response')
}

function parseModelJson(raw: string) {
  const cleaned = stripMarkdownFences(raw)

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    if (err instanceof SyntaxError) {
      return JSON.parse(extractFirstJsonObject(cleaned))
    }
    throw err
  }
}

function dateChunks(dates: string[], size: number) {
  const chunks: string[][] = []
  for (let index = 0; index < dates.length; index += size) {
    chunks.push(dates.slice(index, index + size))
  }
  return chunks
}

function missingItineraryDates(itinerary: Itinerary, requiredDates: string[]) {
  const returnedDates = new Set(itinerary.days.map((day) => day.date))
  return requiredDates.filter((date) => !returnedDates.has(date))
}

function mergeInitialResponses(responses: GeminiResponse[], tripDetails: TripDetails, requiredDates: string[]): GeminiResponse {
  const itineraries = responses
    .map((response) => response.canvas.itinerary)
    .filter((itinerary): itinerary is Itinerary => Boolean(itinerary))

  if (itineraries.length !== responses.length || itineraries.length === 0) {
    throw new Error('A long-trip generation chunk did not contain an itinerary.')
  }

  const daysByDate = new Map(itineraries.flatMap((itinerary) => itinerary.days).map((day) => [day.date, day]))
  const missingDates = requiredDates.filter((date) => !daysByDate.has(date))
  if (missingDates.length > 0) {
    throw new Error(`Long-trip generation omitted dates: ${missingDates.join(', ')}`)
  }

  const first = itineraries[0]
  const merged: Itinerary = {
    ...first,
    trip: { ...first.trip, ...tripDetails },
    summary: itineraries.map((itinerary) => itinerary.summary).filter(Boolean).join(' '),
    days: requiredDates.map((date, index) => ({ ...daysByDate.get(date)!, day: index + 1, date })),
    tips: Array.from(new Set(itineraries.flatMap((itinerary) => itinerary.tips ?? []))).slice(0, 10),
  }

  return {
    message: `I've put together your complete ${requiredDates.length}-day itinerary for ${tripDetails.destination}, with every date planned from ${tripDetails.startDate} through ${tripDetails.endDate}.`,
    canvas: {
      type: 'itinerary',
      clarification: null,
      itinerary: normalizeItineraryMapData(merged),
    },
  }
}

function buildUserPrompt(
  latestMessage: string,
  tripDetails?: TripDetails,
  currentItinerary?: Itinerary | null,
  requiredDates?: string[]
) {
  if (!currentItinerary) {
    const allDates = tripDetails ? getInclusiveTripDates(tripDetails.startDate, tripDetails.endDate) : []
    const datesToGenerate = requiredDates ?? allDates
    const chunkStart = datesToGenerate.length > 0 ? allDates.indexOf(datesToGenerate[0]) + 1 : 0
    const chunkEnd = chunkStart > 0 ? chunkStart + datesToGenerate.length - 1 : 0
    return [
      latestMessage,
      '',
      tripDetails ? `TRIP_DETAILS_JSON: ${JSON.stringify(tripDetails)}` : '',
      allDates.length > 0 ? `INCLUSIVE_TRIP_DAY_COUNT: ${allDates.length}` : '',
      datesToGenerate.length > 0 ? `REQUIRED_DAY_DATES_JSON: ${JSON.stringify(datesToGenerate)}` : '',
      '',
      'Use these trip details to create the itinerary. Return JSON only, using the required response schema.',
      datesToGenerate.length > 0
        ? `Return exactly ${datesToGenerate.length} day objects, one for every date in REQUIRED_DAY_DATES_JSON, in that exact order. Do not omit, combine, summarize, sample, or add dates.`
        : '',
      requiredDates && allDates.length !== requiredDates.length
        ? `This is one server-managed chunk covering day positions ${chunkStart}-${chunkEnd} of the full ${allDates.length}-day trip. Generate exactly and only the requested dates; keep trip.startDate and trip.endDate as the full trip range. Treat this as the middle or end of the same journey when applicable, not as a new standalone trip, and distribute major attractions appropriately for these day positions.`
        : '',
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
    'Preserve fixed-time activities unless the user explicitly changes them. Recalculate start/end times, travelFromPrevious, and travel gaps for the affected day.',
    'After editing, verify each adjacent pair: previous activity end time + travel duration + buffer must fit before the next activity start time.',
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
        maxOutputTokens: 65536,
      },
    })

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const requestModel = async (prompt: string) => {
      const chat = model.startChat({ history })
      const result = await chat.sendMessage(prompt)
      return parseModelJson(result.response.text()) as GeminiResponse
    }

    const requiredDates = !currentItinerary && tripDetails
      ? getInclusiveTripDates(tripDetails.startDate, tripDetails.endDate)
      : []

    let parsed: GeminiResponse
    if (!currentItinerary && tripDetails && requiredDates.length > INITIAL_GENERATION_CHUNK_DAYS) {
      const responses = await Promise.all(
        dateChunks(requiredDates, INITIAL_GENERATION_CHUNK_DAYS).map((chunk) => (
          requestModel(buildUserPrompt(lastMessage.content, tripDetails, null, chunk))
        ))
      )
      parsed = mergeInitialResponses(responses, tripDetails, requiredDates)
    } else {
      parsed = await requestModel(buildUserPrompt(lastMessage.content, tripDetails, currentItinerary, requiredDates))
    }

    // Merge tripDetails into itinerary if Gemini omitted it, then derive reliable map markers.
    if (parsed.canvas?.type === 'itinerary' && parsed.canvas.itinerary) {
      if (tripDetails) {
        parsed.canvas.itinerary.trip = { ...parsed.canvas.itinerary.trip, ...tripDetails }
      }

      if (!currentItinerary && requiredDates.length > 0) {
        const missingDates = missingItineraryDates(parsed.canvas.itinerary, requiredDates)
        if (parsed.canvas.itinerary.days.length !== requiredDates.length || missingDates.length > 0) {
          throw new Error(`Initial itinerary is incomplete. Missing dates: ${missingDates.join(', ') || 'unknown'}`)
        }
      }

      parsed.canvas.itinerary = removeDuplicateBookedActivity(parsed.canvas.itinerary, lastMessage.content)
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
