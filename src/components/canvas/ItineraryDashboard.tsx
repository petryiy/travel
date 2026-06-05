'use client'

import { useMemo, useState } from 'react'
import type { Itinerary, Activity } from '@/types/travel'
import { getDayLocations, getLocationCenter } from '@/lib/itineraryMap'
import { MapView } from './MapView'

const TIME_ICONS: Record<Activity['time'], string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌙',
}

const TYPE_COLORS: Record<Activity['type'], string> = {
  food: 'bg-[#f8dfad] text-[#765320] border-[#e9c98f]',
  attraction: 'bg-[#cfe6ef] text-[#315d69] border-[#accbd6]',
  transport: 'bg-[#e7dfd2] text-[#64523d] border-[#d3c5b0]',
  accommodation: 'bg-[#cfe5d6] text-[#356247] border-[#aac8b3]',
  activity: 'bg-[#d9e8bf] text-[#526931] border-[#bbd39a]',
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

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

interface Props {
  itinerary: Itinerary
  savedTripId: string | null
  isSaving: boolean
  saveStatus: string | null
  saveError: string | null
  onSave: () => void
  onOverview?: () => void
}

export function ItineraryDashboard({ itinerary, savedTripId, isSaving, saveStatus, saveError, onSave, onOverview }: Props) {
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

  const dayTravelMinutes = day?.activities.reduce(
    (total, activity) => total + (activity.travelFromPrevious?.durationMinutes ?? 0),
    0
  ) ?? 0
  const days = itinerary.days.length
  const travelers = itinerary.trip.travelers

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f4efe7] text-[#3e3021]">
      <div className="border-b border-[#dfd4c5] bg-[#fbf7ef] px-6 py-4 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f8a68]">Editing workspace</p>
            <h2 className="mt-1 truncate text-2xl font-bold text-[#2f2419]">{itinerary.trip.destination}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#75624c]">
              <span>{itinerary.trip.startDate} to {itinerary.trip.endDate}</span>
              <span className="h-1 w-1 rounded-full bg-[#b7a791]" />
              <span>{days} {days === 1 ? 'day' : 'days'}</span>
              <span className="h-1 w-1 rounded-full bg-[#b7a791]" />
              <span>{travelers} {travelers === 1 ? 'traveler' : 'travelers'}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-[#8a7965]">
              {itinerary.trip.accommodationLocation && (
                <span className="rounded-full border border-[#d8c9b5] bg-[#fffaf1] px-3 py-1">
                  Staying near {itinerary.trip.accommodationLocation}
                </span>
              )}
              <span className="rounded-full border border-[#d8c9b5] bg-[#fffaf1] px-3 py-1">
                Window {itinerary.trip.dailyStartTime ?? '09:00'} - {itinerary.trip.dailyEndTime ?? '21:00'}
              </span>
            </div>
          </div>

          <div className="flex max-w-xl flex-col items-end gap-3">
            <p className="max-w-lg text-right text-sm leading-6 text-[#75624c]">{itinerary.summary}</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {savedTripId && onOverview && (
                <button
                  type="button"
                  onClick={onOverview}
                  className="rounded-full border border-[#d1c0aa] bg-[#fffaf1] px-4 py-2 text-xs font-semibold text-[#5c4630] shadow-sm transition hover:border-[#bca98d] hover:bg-white"
                >
                  View overview
                </button>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="rounded-full bg-[#5f7d59] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#4f6b49] disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : savedTripId ? 'Save changes' : 'Save trip'}
              </button>
            </div>
            {(saveStatus || saveError) && (
              <p className={`text-xs font-medium ${saveError ? 'text-rose-600' : 'text-[#4f7b4d]'}`}>
                {saveError ?? saveStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 w-[58%] flex-col border-r border-[#dfd4c5]">
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-[#dfd4c5] bg-[#fbf7ef]/70 px-5 py-3">
            {itinerary.days.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  safeActiveDay === i
                    ? 'border-[#5f7d59] bg-[#5f7d59] text-white'
                    : 'border-[#d8c9b5] bg-[#fffaf1] text-[#75624c] hover:border-[#bca98d] hover:bg-white'
                }`}
              >
                Day {d.day}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {day && (
              <>
                <div className="rounded-[28px] border border-[#dfd4c5] bg-[#fffaf1] p-5 shadow-[0_18px_40px_rgba(75,58,36,0.08)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Current day</p>
                      <h3 className="mt-2 text-2xl font-bold text-[#2f2419]">{day.theme}</h3>
                      <p className="mt-1 text-sm font-medium text-[#75624c]">
                        {day.date}
                        {currentDayWindow ? ` - ${currentDayWindow}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#66523b]">
                      <span className="rounded-full bg-[#f0e4d4] px-3 py-1.5">{day.activities.length} stops</span>
                      <span className="rounded-full bg-[#e1eadb] px-3 py-1.5">{formatMinutes(dayTravelMinutes)} travel</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {day.activities.map((act, i) => (
                    <div key={i} className="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)]">
                      <div className="pt-4 text-left md:text-right">
                        <p className="text-xs font-bold text-[#3e3021]">{formatTimeRange(act)}</p>
                        {act.durationMinutes && (
                          <p className="mt-1 text-[11px] font-medium text-[#a69682]">{act.durationMinutes} min</p>
                        )}
                      </div>

                      <div className="relative flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="mt-5 flex h-8 w-8 items-center justify-center rounded-2xl bg-[#5f7d59] text-xs font-bold text-white shadow-sm">
                            {i + 1}
                          </span>
                          {i < day.activities.length - 1 && <span className="w-px flex-1 bg-[#d7c8b3]" />}
                        </div>

                        <div className="min-w-0 flex-1 rounded-[24px] border border-[#dfd4c5] bg-[#fffaf1] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(75,58,36,0.1)]">
                          {act.travelFromPrevious && (
                            <p className="mb-3 inline-flex rounded-full bg-[#f0e4d4] px-3 py-1 text-[11px] font-semibold text-[#75624c]">
                              {act.travelFromPrevious.durationMinutes} min {act.travelFromPrevious.mode}: {act.travelFromPrevious.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base">{TIME_ICONS[act.time]}</span>
                            <span className="text-xs font-semibold capitalize text-[#a69682]">{act.time}</span>
                            {act.isFixedTime && (
                              <span className="rounded-full bg-[#fff0c2] px-2.5 py-1 text-[11px] font-semibold text-[#8a641f]">
                                fixed time
                              </span>
                            )}
                            <span className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${TYPE_COLORS[act.type]}`}>
                              {act.type}
                            </span>
                          </div>
                          <p className="mt-3 text-base font-bold text-[#2f2419]">{act.title}</p>
                          <p className="mt-1 text-xs font-medium text-[#8a7965]">Pin: {act.location}</p>
                          <p className="mt-3 text-sm leading-6 text-[#5f4c36]">{act.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {itinerary.tips.length > 0 && (
            <div className="shrink-0 border-t border-[#dfd4c5] bg-[#fbf7ef] px-5 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Planning notes</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {itinerary.tips.slice(0, 4).map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-5 text-[#75624c]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8ba27e]" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="flex min-w-[360px] flex-1 flex-col gap-4 p-5">
          <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-[#dfd4c5] bg-[#fffaf1] p-4 shadow-[0_18px_40px_rgba(75,58,36,0.08)]">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Working map</p>
                <h3 className="mt-1 text-lg font-bold text-[#2f2419]">Day {day?.day ?? 1} route</h3>
              </div>
              <div className="rounded-2xl bg-[#f0e4d4] px-3 py-2 text-right text-xs font-semibold text-[#66523b]">
                <p>{mapLocations.length} pins</p>
                <p className="mt-0.5 text-[#8a7965]">{formatMinutes(dayTravelMinutes)} travel</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[#d1c0aa] bg-[#e9e1d4]">
              <MapView center={mapCenter} locations={mapLocations} activeDay={day?.day} />
            </div>
          </div>

          <div className="rounded-[24px] border border-[#dfd4c5] bg-[#fbf7ef] p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Studio focus</p>
            <p className="mt-2 text-sm leading-6 text-[#66523b]">
              Use the agent to adjust fixed times, swap stops, or rebalance the route. Save when this draft feels ready to become the overview.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
