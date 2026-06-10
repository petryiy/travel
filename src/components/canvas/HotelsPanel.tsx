'use client'

import type { HotelsCanvas, HotelSuggestion } from '@/types/travel'

interface Props {
  canvas: HotelsCanvas
  tripDestination: string
  checkIn: string
  checkOut: string
  guests: number
  isLoading: boolean
  onChipClick: (text: string) => void
  onRetry: () => void
}

function StarRating({ stars }: { stars: number | null }) {
  if (!stars) return null
  return (
    <span className="text-amber-400 text-xs">
      {'★'.repeat(stars)}{'☆'.repeat(Math.max(0, 5 - stars))}
    </span>
  )
}

function HotelCard({ hotel }: { hotel: HotelSuggestion }) {
  return (
    <div className="bg-white rounded-2xl border border-[#dfd4c5] p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-[#2f2419] text-sm leading-tight">{hotel.name}</h3>
        <StarRating stars={hotel.stars} />
      </div>

      <p className="text-xs text-[#7a6a58] mb-2 flex items-center gap-1">
        <span>📍</span>
        {hotel.neighborhood}
      </p>

      {hotel.highlights.length > 0 && (
        <ul className="mb-3 space-y-0.5">
          {hotel.highlights.map((h, i) => (
            <li key={i} className="text-xs text-[#5a4a3a] flex items-start gap-1.5">
              <span className="text-[#5f7d59] mt-0.5 shrink-0">✓</span>
              {h}
            </li>
          ))}
        </ul>
      )}

      {hotel.pricePerNight !== null && (
        <div className="mb-3">
          <p className="text-sm font-semibold text-[#3e3021]">
            ${hotel.pricePerNight.toFixed(0)}
            <span className="text-xs font-normal text-[#7a6a58]"> / night</span>
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <a
          href={hotel.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs font-medium rounded-full py-1.5 bg-[#003580] text-white hover:bg-[#00286b] transition"
        >
          {hotel.primaryLabel ?? 'Booking.com ↗'}
        </a>
        <a
          href={hotel.googleHotelsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs font-medium rounded-full py-1.5 border border-[#dfd4c5] text-[#3e3021] hover:bg-[#f4efe7] transition"
        >
          {hotel.secondaryLabel ?? 'Google Hotels ↗'}
        </a>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#dfd4c5] p-4 animate-pulse">
      <div className="h-4 bg-[#ece5d8] rounded-full w-3/4 mb-2" />
      <div className="h-3 bg-[#ece5d8] rounded-full w-1/2 mb-3" />
      <div className="h-3 bg-[#ece5d8] rounded-full w-full mb-1.5" />
      <div className="h-3 bg-[#ece5d8] rounded-full w-5/6 mb-3" />
      <div className="flex gap-2">
        <div className="flex-1 h-7 bg-[#ece5d8] rounded-full" />
        <div className="flex-1 h-7 bg-[#ece5d8] rounded-full" />
      </div>
    </div>
  )
}

export function HotelsPanel({
  canvas,
  tripDestination,
  checkIn,
  checkOut,
  guests,
  isLoading,
  onChipClick,
  onRetry,
}: Props) {
  const bookingFallback = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(tripDestination)}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${guests}`

  if (canvas.panelState === 'asking' && canvas.question) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fbf7ef] p-6">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white border border-[#dfd4c5] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#5f7d59] flex items-center justify-center text-white text-sm font-bold shrink-0">
                🏨
              </div>
              <div>
                <p className="text-xs text-[#7a6a58]">Hotels for {tripDestination}</p>
                <p className="text-sm font-semibold text-[#2f2419]">A quick question</p>
              </div>
            </div>

            <p className="text-[#3e3021] text-sm leading-relaxed mb-5">{canvas.question}</p>

            {canvas.questionSuggestions && canvas.questionSuggestions.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-semibold text-[#7a6a58] uppercase tracking-wide">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {canvas.questionSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onChipClick(s)}
                      disabled={isLoading}
                      className="px-3.5 py-1.5 rounded-full border border-[#5f7d59] text-[#5f7d59] bg-white text-sm hover:bg-[#f0f5ef] transition disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-[#7a6a58] text-center">Or type your answer in the chat →</p>
          </div>
        </div>
      </div>
    )
  }

  if (canvas.panelState === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fbf7ef] p-6">
        <div className="text-center space-y-4 max-w-xs">
          <div className="text-4xl">😔</div>
          <p className="text-[#3e3021] font-semibold">Could not load hotel suggestions</p>
          <p className="text-sm text-[#7a6a58]">{canvas.errorMessage ?? 'Something went wrong.'}</p>
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={onRetry}
              className="px-5 py-2 rounded-full bg-[#5f7d59] text-white text-sm font-medium hover:bg-[#4e6a49] transition"
            >
              Try again
            </button>
            <a
              href={bookingFallback}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#5f7d59] underline underline-offset-2 hover:text-[#4e6a49]"
            >
              Browse hotels on Booking.com ↗
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (canvas.panelState === 'searching' || canvas.panelState === 'idle') {
    return (
      <div className="flex-1 overflow-y-auto bg-[#fbf7ef] p-5">
        <p className="text-sm text-[#7a6a58] mb-4">Finding the best hotels in {tripDestination}…</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (canvas.panelState === 'results' && canvas.data) {
    const { data } = canvas
    return (
      <div className="flex-1 overflow-y-auto bg-[#fbf7ef] p-5 space-y-5">
        {data.geminiNote && (
          <div className="bg-white rounded-2xl border border-[#dfd4c5] p-4 text-sm text-[#3e3021] leading-relaxed">
            <span className="mr-2">💡</span>
            {data.geminiNote}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#2f2419]">Hotels in {data.cityName}</h2>
            <span className="text-xs text-[#7a6a58]">
              {data.checkIn} → {data.checkOut} · {data.guests} guest{data.guests !== 1 ? 's' : ''}
            </span>
          </div>

          {data.source === 'travelpayouts' && (
            <p className="text-xs text-[#5f7d59] bg-[#f0f5ef] rounded-xl px-3 py-2 mb-3">
              ✓ Live prices from Booking.com, Expedia & more — sorted cheapest first
            </p>
          )}
          {data.source === 'fallback' && (
            <p className="text-xs text-[#7a6a58] bg-[#f4efe7] rounded-xl px-3 py-2 mb-3">
              Click any card to search live prices and availability
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.suggestions.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        </div>

        <p className="text-center">
          <a
            href={bookingFallback}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#5f7d59] underline underline-offset-2 hover:text-[#4e6a49]"
          >
            See all hotels on Booking.com ↗
          </a>
        </p>
      </div>
    )
  }

  return null
}
