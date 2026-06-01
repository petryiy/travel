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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
          Fill in your trip details on the right to get started.
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'assistant' && (
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 mr-2">
              G
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-zinc-100 text-zinc-800 rounded-bl-sm'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 mr-2">
            G
          </div>
          <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
            <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
