'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
  hasItinerary?: boolean
}

export function ChatInput({ onSend, disabled, hasItinerary = false }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="border-t border-zinc-200 px-4 py-3">
      <div className="flex items-end gap-2 bg-zinc-100 rounded-2xl px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={hasItinerary ? 'Try: “I booked a 14:00 museum slot on day 2, rearrange that day”…' : 'Type a message…'}
          rows={1}
          className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 resize-none outline-none max-h-40 leading-relaxed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 mb-0.5 disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[11px] text-zinc-400 mt-1.5">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  )
}
