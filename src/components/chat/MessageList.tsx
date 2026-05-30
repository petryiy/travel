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
      {messages.length === 0 && (
        <div className="flex h-full items-center justify-center text-center text-sm leading-6 text-slate-400">
          Complete the trip brief to start a planning session.
        </div>
      )}

      {messages.map((message, index) => (
        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {message.role === 'assistant' && (
            <div className="mr-2 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-slate-950 text-xs font-semibold text-white">
              A
            </div>
          )}
          <div
            className={`max-w-[82%] rounded-[8px] px-3.5 py-2.5 text-sm leading-6 ${
              message.role === 'user' ? 'bg-[#276f65] text-white' : 'bg-slate-100 text-slate-800'
            }`}
          >
            {message.content}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="mr-2 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-slate-950 text-xs font-semibold text-white">
            A
          </div>
          <div className="flex items-center gap-1 rounded-[8px] bg-slate-100 px-4 py-3">
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
