'use client'

import { useState } from 'react'
import type { Itinerary, Activity } from '@/types/travel'
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

interface Props {
  itinerary: Itinerary
}

export function ItineraryDashboard({ itinerary }: Props) {
  const [activeDay, setActiveDay] = useState(0)
  const day = itinerary.days[activeDay]

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
          </div>
          <p className="text-sm text-zinc-500 max-w-md text-right leading-relaxed">{itinerary.summary}</p>
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
                  activeDay === i
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
                </div>
                {day.activities.map((act, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{TIME_ICONS[act.time]}</span>
                      <span className="text-xs text-zinc-400 capitalize">{act.time}</span>
                      <span className={`ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[act.type]}`}>
                        {act.type}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-zinc-900">{act.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 mb-2">📍 {act.location}</p>
                    <p className="text-xs text-zinc-600 leading-relaxed">{act.description}</p>
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
          <MapView center={itinerary.mapCenter} locations={itinerary.keyLocations} />
        </div>
      </div>
    </div>
  )
}
