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
    <div className="flex h-[42dvh] min-h-[260px] w-full shrink-0 flex-col border-b border-[#dfd4c5] bg-[#f6efe3] lg:h-auto lg:min-h-0 lg:w-[410px] lg:border-b-0 lg:border-r">
      <div className="border-b border-[#dfd4c5] px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#3f5f4c] text-sm font-bold text-[#fffaf0] shadow-sm">
              G
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#35291d]">Agent notebook</p>
              <p className="truncate text-xs text-[#8a7965]">{hasItinerary ? 'Refine the plan with MeetU' : 'Start with the trip basics'}</p>
            </div>
          </div>
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="shrink-0 rounded-full border border-[#d6c9b8] bg-[#fffaf1] px-2.5 py-1.5 text-xs font-semibold text-[#66523b] shadow-sm transition hover:border-[#bda98d] hover:bg-white sm:px-3"
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
