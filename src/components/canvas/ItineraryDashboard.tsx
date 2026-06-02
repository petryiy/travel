'use client'

import { useMemo, useState } from 'react'
import type { Itinerary, Activity } from '@/types/travel'
import { downloadItineraryMarkdown } from '@/lib/itineraryExport'
import { getDayLocations, getLocationCenter } from '@/lib/itineraryMap'
import { MapView } from './MapView'

const TIME_ICONS: Record<Activity['time'], string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌙',
}

const TYPE_COLORS: Record<Activity['type'], string> = {
  food: 'bg-orange-100 text-orange-700',
  attraction: 'bg-blue-100 text-blue-700',
  transport: 'bg-zinc-100 text-zinc-600',
  accommodation: 'bg-purple-100 text-purple-700',
  activity: 'bg-green-100 text-green-700',
}

function formatTimeRange(activity: Activity) {
  if (activity.startTime && activity.endTime) return `${activity.startTime} - ${activity.endTime}`
  if (activity.startTime) return activity.startTime
  return activity.time
}

function dayWindow(dayStart?: string, dayEnd?: string) {
  if (dayStart && dayEnd) return `${dayStart} - ${dayEnd}`
  if (dayStart) return `from ${dayStart}`
  if (dayEnd) return `until ${dayEnd}`
  return null
}

interface Props {
  itinerary: Itinerary
  savedTripId: string | null
  isSaving: boolean
  saveStatus: string | null
  saveError: string | null
  onSave: () => void
}

export function ItineraryDashboard({ itinerary, savedTripId, isSaving, saveStatus, saveError, onSave }: Props) {
  const [activeDay, setActiveDay] = useState(0)
  const safeActiveDay = Math.min(activeDay, Math.max(itinerary.days.length - 1, 0))
  const day = itinerary.days[safeActiveDay]
  const dayLocations = useMemo(() => (day ? getDayLocations(day) : []), [day])
  const activeKeyLocations = itinerary.keyLocations.filter((location) => !day || location.day === day.day)
  const mapLocations = dayLocations.length > 0
    ? dayLocations
    : activeKeyLocations.length > 0
      ? activeKeyLocations
      : itinerary.keyLocations
  const mapCenter = getLocationCenter(mapLocations, itinerary.mapCenter)
  const currentDayWindow = dayWindow(
    day?.startTime ?? itinerary.trip.dailyStartTime,
    day?.endTime ?? itinerary.trip.dailyEndTime
  )

  const nights = itinerary.days.length
  const travelers = itinerary.trip.travelers

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{itinerary.trip.destination}</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              {itinerary.trip.startDate} → {itinerary.trip.endDate} · {nights} {nights === 1 ? 'night' : 'nights'} · {travelers} {travelers === 1 ? 'traveler' : 'travelers'}
            </p>
            {itinerary.trip.accommodationLocation && (
              <p className="text-xs text-zinc-400 mt-1">
                Staying near {itinerary.trip.accommodationLocation}
              </p>
            )}
            <p className="text-xs text-zinc-400 mt-1">
              Available window: {itinerary.trip.dailyStartTime ?? '09:00'} - {itinerary.trip.dailyEndTime ?? '21:00'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-sm text-zinc-500 max-w-md text-right leading-relaxed">{itinerary.summary}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {isSaving ? 'Saving...' : savedTripId ? 'Save changes' : 'Save trip'}
              </button>
              <button
                type="button"
                onClick={() => downloadItineraryMarkdown(itinerary)}
                className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
              >
                Export .md
              </button>
            </div>
            {(saveStatus || saveError) && (
              <p className={`text-xs ${saveError ? 'text-rose-500' : 'text-emerald-600'}`}>
                {saveError ?? saveStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Day list + activities */}
        <div className="flex flex-col w-[55%] overflow-hidden border-r border-zinc-200">
          {/* Day tabs */}
          <div className="flex overflow-x-auto gap-1.5 px-4 py-3 bg-white border-b border-zinc-200 shrink-0">
            {itinerary.days.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  safeActiveDay === i
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                Day {d.day}
              </button>
            ))}
          </div>

          {/* Activities */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {day && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-zinc-900">{day.date}</span>
                  <span className="text-sm text-zinc-500">— {day.theme}</span>
                  {currentDayWindow && (
                    <span className="ml-auto text-xs font-medium text-zinc-400">Planned {currentDayWindow}</span>
                  )}
                </div>
                {day.activities.map((act, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-20 shrink-0 pt-4 text-right">
                      <p className="text-xs font-bold text-zinc-900">{formatTimeRange(act)}</p>
                      {act.durationMinutes && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">{act.durationMinutes} min</p>
                      )}
                    </div>
                    <div className="relative flex flex-col items-center">
                      <span className="mt-5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-sm">
                        {i + 1}
                      </span>
                      {i < day.activities.length - 1 && <span className="w-px flex-1 bg-zinc-200" />}
                    </div>
                    <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                      {act.travelFromPrevious && (
                        <p className="mb-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                          {act.travelFromPrevious.durationMinutes} min {act.travelFromPrevious.mode}: {act.travelFromPrevious.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{TIME_ICONS[act.time]}</span>
                        <span className="text-xs text-zinc-400 capitalize">{act.time}</span>
                        {act.isFixedTime && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            fixed time
                          </span>
                        )}
                        <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[act.type]}`}>
                          {act.type}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-900">{act.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5 mb-2">📍 {act.location}</p>
                      <p className="text-xs text-zinc-600 leading-relaxed">{act.description}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Tips */}
          {itinerary.tips.length > 0 && (
            <div className="border-t border-zinc-200 px-4 py-3 bg-white shrink-0">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Tips</p>
              <ul className="space-y-1">
                {itinerary.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-zinc-600 flex gap-1.5">
                    <span className="text-indigo-400 shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Map */}
        <div className="flex-1 p-4">
          <MapView center={mapCenter} locations={mapLocations} activeDay={day?.day} />
        </div>
      </div>
    </div>
  )
}
