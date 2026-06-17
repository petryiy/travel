'use client'

import Link from 'next/link'
import type { SavedTripSummary } from '@/types/travel'

interface Props {
  savedTrips: SavedTripSummary[]
  isLoadingTrips: boolean
  onNewTrip: () => void
  onOpenTrip: (tripId: string) => void
}

const STYLE_STAMPS: Record<SavedTripSummary['style'], string> = {
  relax: 'bg-[#e3efe2] text-[#496248]',
  culture: 'bg-[#e3eef2] text-[#3f6070]',
  adventure: 'bg-[#f3dfcf] text-[#8a5438]',
  mixed: 'bg-[#f2e7d4] text-[#6b553b]',
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

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function Dashboard({ savedTrips, isLoadingTrips, onNewTrip, onOpenTrip }: Props) {
  return (
    <main className="min-h-full flex-1 overflow-y-auto bg-[#f7f3ec] text-[#2f2419]">
      <section className="sticky top-0 z-20 border-b border-[#e0d7cb] bg-[#fbf8f2]/95 backdrop-blur lg:static lg:bg-[#fbf8f2] lg:backdrop-blur-0">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-[#2f2419]">Your trips</h1>
            <p className="mt-1 text-sm text-[#7d6c58]">
              {isLoadingTrips ? 'Loading saved plans...' : `${savedTrips.length} saved ${savedTrips.length === 1 ? 'plan' : 'plans'}`}
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <Link
              href="/footprints"
              className="rounded-full border border-[#d8cbb9] bg-white px-3 py-2 text-center text-xs font-semibold text-[#7d6c58] transition hover:bg-[#fffaf2] hover:text-[#5f7d59] sm:flex-none sm:px-4 sm:text-sm"
            >
              Footprints
            </Link>
            <Link
              href="/gallery"
              className="rounded-full border border-[#d8cbb9] bg-white px-3 py-2 text-center text-xs font-semibold text-[#7d6c58] transition hover:bg-[#fffaf2] hover:text-[#5f7d59] sm:flex-none sm:px-4 sm:text-sm"
            >
              Gallery
            </Link>
            <button
              type="button"
              onClick={onNewTrip}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#5f7d59] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#4f6b49] sm:flex-none sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <PlusIcon />
              New
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#7d6c58]">Saved plans</h2>
          {isLoadingTrips && <span className="text-sm text-[#9c8d7a]">Loading...</span>}
        </div>

        {!isLoadingTrips && savedTrips.length === 0 && (
          <div className="rounded-3xl border border-dashed border-[#d5c6b3] bg-[#fffaf2] p-6 text-center sm:p-10">
            <p className="text-base font-bold text-[#2f2419]">No saved trips yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7d6c58]">
              Create a new itinerary and save it here when the plan is ready.
            </p>
            <button
              type="button"
              onClick={onNewTrip}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#5f7d59] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4f6b49]"
            >
              <PlusIcon />
              Plan your first trip
            </button>
          </div>
        )}

        {savedTrips.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {savedTrips.map((trip) => {
              const updatedAt = formatUpdatedAt(trip.updatedAt)
              const hasCustomTitle = trip.title && trip.title !== trip.destination

              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => onOpenTrip(trip.id)}
                  className="group rounded-2xl border border-[#e0d7cb] bg-[#fffaf2] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#cbbba5] hover:bg-white hover:shadow-md sm:min-h-60 sm:rounded-3xl sm:p-5"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-[#2f2419] sm:text-2xl">{trip.title || trip.destination}</p>
                        <p className="mt-1 text-sm font-medium text-[#7d6c58]">
                          {formatDateRange(trip.startDate, trip.endDate)}
                        </p>
                        {hasCustomTitle && (
                          <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.12em] text-[#a0927f]">
                            {trip.destination}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STYLE_STAMPS[trip.style]}`}>
                          {trip.style}
                        </span>
                        {trip.isPublished && (
                          <span className="rounded-full bg-[#efe7d8] px-3 py-1 text-xs font-bold text-[#7d6c58]">
                            Published
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#66523b] sm:mt-5 sm:line-clamp-4">{trip.summary}</p>

                    <div className="mt-auto pt-4 sm:pt-6">
                      <div className="flex items-center justify-between gap-3 border-t border-[#eadfce] pt-3 text-xs font-semibold text-[#9a8a76] sm:pt-4">
                        <span>
                          {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}
                        </span>
                        {updatedAt && <span>Updated {updatedAt}</span>}
                      </div>
                      <div className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#5f7d59] transition group-hover:gap-3 sm:mt-4">
                        Open plan
                        <ArrowIcon />
                      </div>
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
