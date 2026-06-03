'use client'

import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { Message } from '@/types/travel'

interface Props {
  messages: Message[]
  isLoading: boolean
  onSend: (text: string) => void
  hasItinerary?: boolean
  onBackToDashboard?: () => void
}

export function ChatPanel({ messages, isLoading, onSend, hasItinerary = false, onBackToDashboard }: Props) {
  return (
    <div className="w-[400px] shrink-0 flex flex-col border-r border-zinc-200 bg-white">
      <div className="px-5 py-4 border-b border-zinc-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex shrink-0 items-center justify-center text-white text-sm font-bold">
              G
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">Gemini Travel Agent</p>
              <p className="truncate text-xs text-zinc-400">{hasItinerary ? 'Ready to refine your itinerary' : 'Powered by Google AI'}</p>
            </div>
          </div>
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50"
            >
              Dashboard
            </button>
          )}
        </div>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={onSend} disabled={isLoading} hasItinerary={hasItinerary} />
    </div>
  )
}
