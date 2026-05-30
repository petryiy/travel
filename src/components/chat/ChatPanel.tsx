'use client'

import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { Message } from '@/types/travel'

interface Props {
  messages: Message[]
  isLoading: boolean
  onSend: (text: string) => void
}

export function ChatPanel({ messages, isLoading, onSend }: Props) {
  return (
    <div className="w-[400px] shrink-0 flex flex-col border-r border-zinc-200 bg-white">
      <div className="px-5 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
            G
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Gemini Travel Planner</p>
            <p className="text-xs text-zinc-400">Powered by Google AI</p>
          </div>
        </div>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={onSend} disabled={isLoading} />
    </div>
  )
}
