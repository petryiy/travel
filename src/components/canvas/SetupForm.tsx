'use client'

import { useState, FormEvent } from 'react'
import { getInclusiveTripDayCount } from '@/lib/tripDates'
import type { SavedTripSummary, TripDetails, TripStyle } from '@/types/travel'

const STYLES: { value: TripStyle; label: string; emoji: string; desc: string }[] = [
  { value: 'relax', label: 'Relax', emoji: '🌴', desc: 'Beaches, spas & slow mornings' },
  { value: 'culture', label: 'Culture', emoji: '🏛️', desc: 'Museums, history & local life' },
  { value: 'adventure', label: 'Adventure', emoji: '🧗', desc: 'Hikes, thrills & the outdoors' },
  { value: 'mixed', label: 'Mixed', emoji: '✨', desc: 'A little bit of everything' },
]

interface Props {
  savedTrips: SavedTripSummary[]
  isLoadingSavedTrips: boolean
  onSubmit: (details: TripDetails) => void
  onOpenSavedTrip: (tripId: string) => void
}

export function SetupForm({ savedTrips, isLoadingSavedTrips, onSubmit, onOpenSavedTrip }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [destination, setDestination] = useState('')
  const [accommodationLocation, setAccommodationLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [travelers, setTravelers] = useState(2)
  const [style, setStyle] = useState<TripStyle>('mixed')
  const [dailyStartTime, setDailyStartTime] = useState('09:00')
  const [dailyEndTime, setDailyEndTime] = useState('21:00')
  const selectedDayCount = getInclusiveTripDayCount(startDate, endDate)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!destination.trim() || !startDate || !endDate || selectedDayCount === 0 || dailyStartTime >= dailyEndTime) return
    onSubmit({
      destination: destination.trim(),
      accommodationLocation: accommodationLocation.trim() || undefined,
      startDate,
      endDate,
      travelers,
      style,
      dailyStartTime,
      dailyEndTime,
    })
  }

  return (
    <div className="flex-1 overflow-y-auto flex items-start justify-center bg-[#f7f3ec] p-4 sm:bg-gradient-to-br sm:from-indigo-50 sm:via-white sm:to-purple-50 sm:p-8">
      <div className="w-full max-w-lg">
        <div className="mb-5 text-left sm:mb-8 sm:text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e1eadb] text-2xl shadow-sm sm:block sm:h-auto sm:w-auto sm:bg-transparent sm:text-5xl sm:shadow-none">✈️</div>
          <h1 className="text-2xl font-bold text-[#2f2419] sm:text-zinc-900">Plan your next trip</h1>
          <p className="mt-1.5 text-sm text-[#7d6c58] sm:text-zinc-500">Tell MeetU the basics and we will shape the route.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-[#e0d7cb] bg-[#fffaf2] p-4 shadow-sm sm:space-y-5 sm:rounded-3xl sm:border-0 sm:bg-white sm:p-7 sm:shadow-xl sm:shadow-zinc-200/60">
          {/* Destination */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
              Destination
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Tokyo, Paris, Bali…"
              required
              className="w-full rounded-xl border border-[#d8c9b5] bg-white px-4 py-3 text-base text-[#2f2419] outline-none transition placeholder:text-[#b2a28d] focus:border-transparent focus:ring-2 focus:ring-[#8ba27e] sm:border-zinc-200 sm:py-2.5 sm:text-sm sm:text-zinc-900 sm:placeholder:text-zinc-400 sm:focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
              Staying near
            </label>
            <input
              type="text"
              value={accommodationLocation}
              onChange={(e) => setAccommodationLocation(e.target.value)}
              placeholder="e.g. The Rocks, Shinjuku, hotel name, or address"
              className="w-full rounded-xl border border-[#d8c9b5] bg-white px-4 py-3 text-base text-[#2f2419] outline-none transition placeholder:text-[#b2a28d] focus:border-transparent focus:ring-2 focus:ring-[#8ba27e] sm:border-zinc-200 sm:py-2.5 sm:text-sm sm:text-zinc-900 sm:placeholder:text-zinc-400 sm:focus:ring-indigo-400"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-xl border border-[#d8c9b5] bg-white px-4 py-3 text-base text-[#2f2419] outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#8ba27e] sm:border-zinc-200 sm:py-2.5 sm:text-sm sm:text-zinc-900 sm:focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-xl border border-[#d8c9b5] bg-white px-4 py-3 text-base text-[#2f2419] outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#8ba27e] sm:border-zinc-200 sm:py-2.5 sm:text-sm sm:text-zinc-900 sm:focus:ring-indigo-400"
              />
            </div>
          </div>
          {startDate && endDate && selectedDayCount > 0 && (
            <p className="-mt-2 text-xs font-semibold text-[#6f8a68] sm:text-indigo-600">
              {selectedDayCount} {selectedDayCount === 1 ? 'day' : 'days'} selected
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
                Daily start
              </label>
              <input
                type="time"
                value={dailyStartTime}
                onChange={(e) => setDailyStartTime(e.target.value)}
                required
                className="w-full rounded-xl border border-[#d8c9b5] bg-white px-4 py-3 text-base text-[#2f2419] outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#8ba27e] sm:border-zinc-200 sm:py-2.5 sm:text-sm sm:text-zinc-900 sm:focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
                Back by
              </label>
              <input
                type="time"
                value={dailyEndTime}
                onChange={(e) => setDailyEndTime(e.target.value)}
                required
                className="w-full rounded-xl border border-[#d8c9b5] bg-white px-4 py-3 text-base text-[#2f2419] outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#8ba27e] sm:border-zinc-200 sm:py-2.5 sm:text-sm sm:text-zinc-900 sm:focus:ring-indigo-400"
              />
            </div>
          </div>

          {dailyStartTime >= dailyEndTime && (
            <p className="text-xs text-rose-500">Daily start time must be earlier than the return time.</p>
          )}

          {/* Travelers */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
              Travelers
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTravelers((n) => Math.max(1, n - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8c9b5] bg-white text-lg font-light text-[#5f4c36] transition hover:bg-[#fbf7ef] sm:h-9 sm:w-9 sm:border-zinc-200 sm:text-zinc-600 sm:hover:bg-zinc-50"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold text-[#2f2419] sm:w-6 sm:text-zinc-900">{travelers}</span>
              <button
                type="button"
                onClick={() => setTravelers((n) => Math.min(10, n + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8c9b5] bg-white text-lg font-light text-[#5f4c36] transition hover:bg-[#fbf7ef] sm:h-9 sm:w-9 sm:border-zinc-200 sm:text-zinc-600 sm:hover:bg-zinc-50"
              >
                +
              </button>
              <span className="ml-1 text-sm text-[#9a876f] sm:text-zinc-400">{travelers === 1 ? 'person' : 'people'}</span>
            </div>
          </div>

          {/* Trip style */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#7d6c58] sm:text-zinc-500">
              Trip style
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                    style === s.value
                      ? 'border-[#6f8a68] bg-[#eef5e9] ring-1 ring-[#8ba27e] sm:border-indigo-500 sm:bg-indigo-50 sm:ring-indigo-400'
                      : 'border-[#d8c9b5] bg-white hover:border-[#bda98d] hover:bg-[#fbf7ef] sm:border-zinc-200 sm:hover:border-zinc-300 sm:hover:bg-zinc-50'
                  }`}
                >
                  <span className="text-xl leading-none mt-0.5">{s.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#2f2419] sm:text-zinc-900">{s.label}</p>
                    <p className="text-xs leading-snug text-[#9a876f] sm:text-zinc-400">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!destination.trim() || !startDate || !endDate || selectedDayCount === 0 || dailyStartTime >= dailyEndTime}
            className="w-full rounded-xl bg-[#5f7d59] py-3.5 text-sm font-semibold text-white transition hover:bg-[#4f6b49] disabled:opacity-40 sm:bg-indigo-600 sm:py-3 sm:hover:bg-indigo-700"
          >
            Start planning →
          </button>
        </form>

        <div className="mt-5 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">Saved trips</h2>
            {isLoadingSavedTrips && <span className="text-xs text-zinc-400">Loading...</span>}
          </div>

          {!isLoadingSavedTrips && savedTrips.length === 0 && (
            <p className="text-xs text-zinc-400 leading-relaxed">
              Save a trip from the itinerary view and it will appear here.
            </p>
          )}

          {savedTrips.length > 0 && (
            <div className="space-y-2">
              {savedTrips.slice(0, 4).map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => onOpenSavedTrip(trip.id)}
                  className="w-full rounded-xl border border-zinc-100 px-3 py-2.5 text-left hover:bg-zinc-50 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{trip.title || trip.destination}</p>
                    <span className="text-[11px] text-zinc-400 shrink-0">{trip.travelers} pax</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {trip.startDate} to {trip.endDate}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
