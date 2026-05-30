'use client'

import type { ClarificationData } from '@/types/travel'

interface Props {
  clarification: ClarificationData
  onSend: (text: string) => void
  isLoading: boolean
}

export function ClarificationCard({ clarification, onSend, isLoading }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center bg-[#f7f6f1] p-8">
      <div className="w-full max-w-lg rounded-[8px] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-slate-950 text-sm font-semibold text-white">
            A
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clarification</p>
            <p className="text-sm font-semibold text-slate-950">One detail will improve the plan</p>
          </div>
        </div>

        <p className="mb-6 text-base leading-7 text-slate-800">{clarification.question}</p>

        {clarification.suggestions && clarification.suggestions.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested answers</p>
            <div className="flex flex-wrap gap-2">
              {clarification.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSend(suggestion)}
                  disabled={isLoading}
                  className="rounded-[8px] border border-[#bfd8d3] bg-[#eef7f5] px-4 py-2 text-sm font-semibold text-[#276f65] transition hover:bg-[#e0f0ec] disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">Or answer in the chat.</p>
      </div>
    </div>
  )
}
