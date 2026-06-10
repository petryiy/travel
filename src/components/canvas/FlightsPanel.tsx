'use client'

import type { FlightsCanvas, FlightOption } from '@/types/travel'

interface Props {
  canvas: FlightsCanvas
  tripDestination: string
  departureDate: string
  returnDate: string | null
  passengers: number
  isLoading: boolean
  onChipClick: (text: string) => void
  onRetry: () => void
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '–'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function FlightCard({ option }: { option: FlightOption }) {
  return (
    <div className="bg-white rounded-2xl border border-[#dfd4c5] p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✈️</span>
          <div>
            <p className="font-semibold text-[#2f2419] text-sm">
              {option.from} → {option.to}
            </p>
            {option.airline && (
              <p className="text-xs text-[#7a6a58]">{option.airline}</p>
            )}
          </div>
        </div>
        {option.totalPrice !== null ? (
          <p className="text-sm font-semibold text-[#3e3021]">
            {option.currency} {option.totalPrice.toFixed(0)}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-4 text-xs text-[#7a6a58] mb-3">
        <span>🕐 {formatDuration(option.durationMinutes)}</span>
        <span>
          {option.stops === 0
            ? '✈ Direct'
            : `${option.stops} stop${option.stops !== 1 ? 's' : ''}`}
        </span>
        <span>📅 {option.departureDate}</span>
      </div>

      {option.totalPrice === null && (
        <p className="text-xs text-[#7a6a58] italic mb-3">Check site for current pricing</p>
      )}

      <div className="flex gap-2">
        <a
          href={option.skyscannerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs font-medium rounded-full py-1.5 bg-[#0770e3] text-white hover:bg-[#0558b5] transition"
        >
          Skyscanner ↗
        </a>
        <a
          href={option.googleFlightsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs font-medium rounded-full py-1.5 border border-[#dfd4c5] text-[#3e3021] hover:bg-[#f4efe7] transition"
        >
          Google Flights ↗
        </a>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#dfd4c5] p-4 animate-pulse">
      <div className="h-4 bg-[#ece5d8] rounded-full w-1/2 mb-2" />
      <div className="h-3 bg-[#ece5d8] rounded-full w-2/3 mb-3" />
      <div className="h-3 bg-[#ece5d8] rounded-full w-1/3 mb-3" />
      <div className="flex gap-2">
        <div className="flex-1 h-7 bg-[#ece5d8] rounded-full" />
        <div className="flex-1 h-7 bg-[#ece5d8] rounded-full" />
      </div>
    </div>
  )
}

export function FlightsPanel({
  canvas,
  tripDestination,
  departureDate,
  returnDate,
  passengers,
  isLoading,
  onChipClick,
  onRetry,
}: Props) {
  const skyscannerFallback = `https://www.skyscanner.net/transport/flights/anywhere/${encodeURIComponent(tripDestination.toLowerCase().replace(/\s+/g, '-'))}/${departureDate.replace(/-/g, '').slice(2)}/${returnDate ? returnDate.replace(/-/g, '').slice(2) : departureDate.replace(/-/g, '').slice(2)}/?adults=${passengers}`

  if (canvas.panelState === 'asking' && canvas.question) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fbf7ef] p-6">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white border border-[#dfd4c5] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#5f7d59] flex items-center justify-center text-white text-sm font-bold shrink-0">
                ✈️
              </div>
              <div>
                <p className="text-xs text-[#7a6a58]">Flights to {tripDestination}</p>
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
          <p className="text-[#3e3021] font-semibold">Could not load flight options</p>
          <p className="text-sm text-[#7a6a58]">{canvas.errorMessage ?? 'Something went wrong.'}</p>
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={onRetry}
              className="px-5 py-2 rounded-full bg-[#5f7d59] text-white text-sm font-medium hover:bg-[#4e6a49] transition"
            >
              Try again
            </button>
            <a
              href={skyscannerFallback}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#5f7d59] underline underline-offset-2 hover:text-[#4e6a49]"
            >
              Search flights on Skyscanner ↗
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (canvas.panelState === 'searching' || canvas.panelState === 'idle') {
    return (
      <div className="flex-1 overflow-y-auto bg-[#fbf7ef] p-5">
        <p className="text-sm text-[#7a6a58] mb-4">Finding flights to {tripDestination}…</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <h2 className="font-semibold text-[#2f2419]">
              {data.originCity} → {data.destinationCity}
            </h2>
            <span className="text-xs text-[#7a6a58]">
              {data.passengers} passenger{data.passengers !== 1 ? 's' : ''}
            </span>
          </div>

          {data.source === 'travelpayouts' && (
            <p className="text-xs text-[#5f7d59] bg-[#f0f5ef] rounded-xl px-3 py-2 mb-3">
              ✓ Live fares — sorted cheapest first
            </p>
          )}
          {data.source === 'fallback' && (
            <p className="text-xs text-[#7a6a58] bg-[#f4efe7] rounded-xl px-3 py-2 mb-3">
              Live pricing unavailable — click links to see real-time fares
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.options.map((opt) => (
              <FlightCard key={opt.id} option={opt} />
            ))}
          </div>
        </div>

        <p className="text-center">
          <a
            href={skyscannerFallback}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#5f7d59] underline underline-offset-2 hover:text-[#4e6a49]"
          >
            Search all flights on Skyscanner ↗
          </a>
        </p>
      </div>
    )
  }

  return null
}
