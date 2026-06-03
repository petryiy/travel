'use client'

import type { SavedTripSummary } from '@/types/travel'

interface Props {
  savedTrips: SavedTripSummary[]
  isLoadingTrips: boolean
  onNewTrip: () => void
  onOpenTrip: (tripId: string) => void
}

function formatDateRange(startDate: string, endDate: string) {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function Dashboard({ savedTrips, isLoadingTrips, onNewTrip, onOpenTrip }: Props) {
  return (
    <main className="min-h-full flex-1 overflow-y-auto bg-zinc-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-8 py-8">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Travel workspace</p>
            <h1 className="mt-2 text-3xl font-bold text-zinc-950">Your trips</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Pick up a saved itinerary or start planning something new.
            </p>
          </div>

          <button
            type="button"
            onClick={onNewTrip}
            className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            New trip
          </button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-8 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">Saved trips</h2>
          {isLoadingTrips && <span className="text-sm text-zinc-400">Loading...</span>}
        </div>

        {!isLoadingTrips && savedTrips.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-zinc-900">No saved trips yet</p>
            <p className="mt-2 text-sm text-zinc-500">
              Create a new itinerary and save it to see it here.
            </p>
            <button
              type="button"
              onClick={onNewTrip}
              className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Plan your first trip
            </button>
          </div>
        )}

        {savedTrips.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {savedTrips.map((trip) => {
              const updatedAt = formatUpdatedAt(trip.updatedAt)
              const hasCustomTitle = trip.title && trip.title !== trip.destination

              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => onOpenTrip(trip.id)}
                  className="group min-h-48 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-bold text-zinc-950">{trip.title || trip.destination}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatDateRange(trip.startDate, trip.endDate)}
                        </p>
                        {hasCustomTitle && (
                          <p className="mt-1 truncate text-xs font-medium text-zinc-400">
                            {trip.destination}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">
                        {trip.style}
                      </span>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-600">{trip.summary}</p>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-xs text-zinc-400">
                      <span>
                        {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}
                      </span>
                      {updatedAt && <span>Updated {updatedAt}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
