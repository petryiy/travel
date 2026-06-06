import Link from 'next/link'
import { getClient } from '@/lib/db'
import type { TripStyle } from '@/types/travel'

export const dynamic = 'force-dynamic'

interface GalleryTripRow {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  travelers: number
  style: string
  summary: string
  author_name: string | null
  published_at: Date | null
  updated_at: Date
}

const STYLE_STAMPS: Record<TripStyle, string> = {
  relax: 'bg-[#e3efe2] text-[#496248]',
  culture: 'bg-[#e3eef2] text-[#3f6070]',
  adventure: 'bg-[#f3dfcf] text-[#8a5438]',
  mixed: 'bg-[#f2e7d4] text-[#6b553b]',
}

function formatDateRange(startDate: string, endDate: string) {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`
}

function formatPublishedAt(value: Date | null) {
  if (!value) return null

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

function displayAuthorName(value: string | null) {
  const name = value?.trim()
  return name || 'MeetU traveler'
}

async function getPublishedTrips() {
  const client = await getClient()
  try {
    const { rows } = await client.query<GalleryTripRow>(
      `SELECT t.id, t.title, t.destination, t.start_date, t.end_date, t.travelers, t.style, t.summary,
              u.name AS author_name, t.published_at, t.updated_at
       FROM trips t
       LEFT JOIN users u ON u.id = t.owner_id
       WHERE t.is_published = true
       ORDER BY t.published_at DESC NULLS LAST, t.updated_at DESC
       LIMIT 60`
    )
    return rows
  } finally {
    await client.end()
  }
}

export default async function GalleryPage() {
  const trips = await getPublishedTrips()

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#2f2419]">
      <header className="border-b border-[#e0d7cb] bg-[#fbf8f2]">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3e3021] transition hover:text-[#5f7d59]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#6f8a68] shadow-[0_0_0_4px_rgba(111,138,104,0.16)]" />
            MeetU
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-[#d8cbb9] bg-white px-4 py-2 text-sm font-semibold text-[#66523b] transition hover:bg-[#fffaf2]"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f8a68]">Public gallery</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#2f2419] sm:text-4xl">Travel plans people made with MeetU</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7d6c58]">
              Browse published itineraries for route ideas, daily flow, and future overview styles.
            </p>
          </div>
          <span className="rounded-full border border-[#d8cbb9] bg-[#fffaf2] px-4 py-2 text-sm font-semibold text-[#7d6c58]">
            {trips.length} published {trips.length === 1 ? 'plan' : 'plans'}
          </span>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d5c6b3] bg-[#fffaf2] p-6 text-center sm:p-10">
            <p className="text-base font-bold text-[#2f2419]">No public trips yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#7d6c58]">
              Published plans will appear here once users share them with the Gallery.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {trips.map((trip) => {
              const style = trip.style as TripStyle
              const publishedAt = formatPublishedAt(trip.published_at)
              const authorName = displayAuthorName(trip.author_name)

              return (
                <Link
                  key={trip.id}
                  href={`/share/${trip.id}`}
                  className="group min-h-56 rounded-3xl border border-[#e0d7cb] bg-[#fffaf2] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#cbbba5] hover:bg-white hover:shadow-md sm:min-h-64 sm:p-5"
                >
                  <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-bold text-[#2f2419] sm:text-2xl">{trip.title || trip.destination}</p>
                        <p className="mt-1 text-sm font-medium text-[#7d6c58]">
                          {formatDateRange(trip.start_date, trip.end_date)}
                        </p>
                        <p className="mt-2 max-w-full truncate rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#6f8a68]">
                          by {authorName}
                        </p>
                        {trip.title !== trip.destination && (
                          <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.12em] text-[#a0927f]">
                            {trip.destination}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize ${STYLE_STAMPS[style]}`}>
                        {style}
                      </span>
                    </div>

                    <p className="mt-5 line-clamp-4 text-sm leading-6 text-[#66523b]">{trip.summary}</p>

                    <div className="mt-auto pt-6">
                      <div className="flex items-center justify-between gap-3 border-t border-[#eadfce] pt-4 text-xs font-semibold text-[#9a8a76]">
                        <span>
                          {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}
                        </span>
                        {publishedAt && <span>Published {publishedAt}</span>}
                      </div>
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#5f7d59] transition group-hover:gap-3">
                        View overview
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m13 6 6 6-6 6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
