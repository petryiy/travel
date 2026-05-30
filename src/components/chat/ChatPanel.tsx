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
    <aside className="relative z-10 flex w-[420px] shrink-0 flex-col border-r border-cyan-300/15 bg-slate-950/78 shadow-[0_0_80px_rgba(0,255,209,0.08)] backdrop-blur-md">
      <div className="border-b border-cyan-300/15 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[8px] border border-cyan-300/40 bg-cyan-300/10 text-sm font-semibold text-cyan-100 shadow-[0_0_28px_rgba(0,255,209,0.18)]">
            A
          </div>
          <div>
            <p className="text-sm font-semibold text-cyan-50">AtlasLoop Copilot</p>
            <p className="text-xs text-cyan-200/55">Neural route interface</p>
          </div>
        </div>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={onSend} disabled={isLoading} />
    </aside>
  )
}
