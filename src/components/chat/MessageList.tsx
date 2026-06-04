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
    <div
      className="flex-1 space-y-4 overflow-y-auto px-4 py-5"
      style={{
        backgroundImage: 'radial-gradient(rgba(92, 73, 48, 0.08) 0.7px, transparent 0.7px)',
        backgroundSize: '14px 14px',
      }}
    >
      {messages.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-[260px] rounded-3xl border border-dashed border-[#d7c8b3] bg-[#fffaf1]/80 px-5 py-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-[#4d3c2b]">Your planning notes will appear here.</p>
            <p className="mt-2 text-xs leading-5 text-[#8a7965]">Fill in the trip basics, then ask the agent to shape the route.</p>
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'assistant' && (
            <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#3f5f4c] text-xs font-bold text-[#fffaf0] shadow-sm">
              G
            </div>
          )}
          <div
            className={`max-w-[82%] rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-sm ${
              msg.role === 'user'
                ? 'rounded-br-md bg-[#5f7d59] text-white'
                : 'rounded-bl-md border border-[#e3d5c3] bg-[#fffaf1] text-[#3e3021]'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#3f5f4c] text-xs font-bold text-[#fffaf0] shadow-sm">
            G
          </div>
          <div className="flex items-center gap-1 rounded-[22px] rounded-bl-md border border-[#e3d5c3] bg-[#fffaf1] px-4 py-3 shadow-sm">
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#8ba27e] [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#8ba27e] [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-[#8ba27e]" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
