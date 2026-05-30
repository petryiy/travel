'use client'

import type { ClarificationData } from '@/types/travel'

interface Props {
  clarification: ClarificationData
  onSend: (text: string) => void
  isLoading: boolean
}

export function ClarificationCard({ clarification, onSend, isLoading }: Props) {
  return (
    <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden border-l border-cyan-300/15 bg-slate-950/45 p-8 backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(0,255,209,0.14),transparent_32%),radial-gradient(circle_at_76%_64%,rgba(208,52,255,0.16),transparent_30%)]" />
      <div className="relative w-full max-w-xl rounded-[8px] border border-cyan-300/25 bg-slate-950/76 p-8 shadow-[0_0_90px_rgba(0,255,209,0.16)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] border border-cyan-300/40 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
            A
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Signal required</p>
            <p className="text-sm font-semibold text-slate-200">One answer moves the grid forward</p>
          </div>
        </div>

        <p className="text-xl leading-8 text-white">{clarification.question}</p>

        {clarification.suggestions && clarification.suggestions.length > 0 && (
          <div className="mt-7">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Fast routes</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {clarification.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSend(suggestion)}
                  disabled={isLoading}
                  className="rounded-[8px] border border-cyan-300/20 bg-cyan-300/8 px-3 py-3 text-left text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/15 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">You can also answer in the console.</p>
      </div>
    </div>
  )
}
