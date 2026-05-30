'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/types/travel'

interface Props {
  messages: Message[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((message, index) => (
        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {message.role === 'assistant' && (
            <div className="mr-2 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border border-cyan-300/35 bg-cyan-300/10 text-xs font-semibold text-cyan-100">
              A
            </div>
          )}
          <div
            className={`max-w-[82%] rounded-[8px] border px-3.5 py-2.5 text-sm leading-6 shadow-[0_0_26px_rgba(0,0,0,0.18)] ${
              message.role === 'user'
                ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50'
                : 'border-slate-700/80 bg-slate-900/88 text-slate-200'
            }`}
          >
            {message.content}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="mr-2 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border border-cyan-300/35 bg-cyan-300/10 text-xs font-semibold text-cyan-100">
            A
          </div>
          <div className="flex items-center gap-1 rounded-[8px] border border-slate-700/70 bg-slate-900/88 px-4 py-3">
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
