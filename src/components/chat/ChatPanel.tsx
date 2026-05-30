'use client'

import type { Message } from '@/types/travel'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'

interface Props {
  messages: Message[]
  isLoading: boolean
  onSend: (text: string) => void
}

export function ChatPanel({ messages, isLoading, onSend }: Props) {
  return (
    <aside className="flex w-[410px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[8px] bg-slate-950 text-sm font-semibold text-white">
            A
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">AtlasLoop Copilot</p>
            <p className="text-xs text-slate-500">Plan, refine, and save route-aware trips</p>
          </div>
        </div>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={onSend} disabled={isLoading} />
    </aside>
  )
}
