'use client'

import type { ClarificationData, LocationFocus } from '@/types/travel'

interface Props {
  locationFocus: LocationFocus
  clarification: ClarificationData | null
  isLoading: boolean
  onSend: (text: string) => void
}

export function LocationFocusPanel({ locationFocus, clarification, isLoading, onSend }: Props) {
  return (
    <section className="relative z-10 flex flex-1 overflow-hidden border-l border-cyan-300/15 bg-slate-950/40 backdrop-blur-sm">
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,209,0.18),transparent_34%),radial-gradient(circle_at_76%_24%,rgba(208,52,255,0.18),transparent_28%)]" />
        <div className="map-warp absolute left-1/2 top-1/2 h-[780px] w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/20 bg-slate-950/50 shadow-[0_0_120px_rgba(0,255,209,0.16)]">
          <div className="absolute inset-10 rounded-full border border-cyan-300/15" />
          <div className="absolute inset-24 rounded-full border border-fuchsia-300/10" />
          <div className="absolute inset-40 rounded-full border border-cyan-300/10" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-300/10" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-cyan-300/10" />
          <div className="scan-line absolute inset-x-0 top-1/2 h-px bg-cyan-300/70 shadow-[0_0_24px_rgba(0,255,209,0.85)]" />

          <div className="marker-lock absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-8 w-8 rounded-full border border-cyan-200 bg-cyan-300 shadow-[0_0_44px_rgba(0,255,209,0.85)]" />
            <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30" />
            <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/20" />
          </div>
        </div>

        <div className="absolute left-8 top-8 rounded-[8px] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-[0_0_50px_rgba(0,255,209,0.12)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Coordinate lock</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{locationFocus.name}</h2>
          <p className="mt-2 text-sm text-slate-400">{locationFocus.label}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <Coordinate label="Latitude" value={locationFocus.coordinates.lat.toFixed(4)} />
            <Coordinate label="Longitude" value={locationFocus.coordinates.lng.toFixed(4)} />
          </div>
        </div>
      </div>

      <aside className="w-[390px] shrink-0 border-l border-cyan-300/15 bg-slate-950/75 p-5">
        <div className="mb-5 rounded-[8px] border border-cyan-300/20 bg-cyan-300/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Base acquired</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The map anchor is set. AtlasLoop will now build outward from this point and keep travel pressure visible.
          </p>
        </div>

        {clarification && (
          <div className="rounded-[8px] border border-fuchsia-300/20 bg-fuchsia-300/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-200">Next signal</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">{clarification.question}</p>
            {clarification.suggestions && (
              <div className="mt-4 grid gap-2">
                {clarification.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onSend(suggestion)}
                    disabled={isLoading}
                    className="rounded-[8px] border border-cyan-300/20 bg-slate-950/70 px-3 py-2 text-left text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/10 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </section>
  )
}

function Coordinate({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-cyan-300/15 bg-slate-950/65 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-cyan-100">{value}</p>
    </div>
  )
}
