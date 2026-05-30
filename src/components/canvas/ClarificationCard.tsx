'use client'

import type { ClarificationData } from '@/types/travel'

interface Props {
  clarification: ClarificationData
  onSend: (text: string) => void
  isLoading: boolean
}

export function ClarificationCard({ clarification, onSend, isLoading }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-zinc-200/60 p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
              G
            </div>
            <div>
              <p className="text-xs text-zinc-400">Gemini has a question</p>
              <p className="text-sm font-semibold text-zinc-900">Quick clarification needed</p>
            </div>
          </div>

          <p className="text-zinc-800 text-base leading-relaxed mb-6">{clarification.question}</p>

          {clarification.suggestions && clarification.suggestions.length > 0 && (
            <div className="space-y-2 mb-6">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {clarification.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => onSend(s)}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50 text-sm hover:bg-indigo-100 transition disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-zinc-400 text-center">
            Or type your answer in the chat →
          </p>
        </div>
      </div>
    </div>
  )
}
