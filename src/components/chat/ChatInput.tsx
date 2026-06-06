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
    <div className="border-t border-[#dfd4c5] bg-[#f6efe3] px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-end gap-2 rounded-[24px] border border-[#d8c9b5] bg-[#fffaf1] px-3 py-2 shadow-sm transition focus-within:border-[#8ba27e] focus-within:ring-4 focus-within:ring-[#8ba27e]/15">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={hasItinerary ? 'Try: “I booked a 14:00 museum slot on day 2, rearrange that day”…' : 'Type a message…'}
          rows={1}
          className="max-h-40 flex-1 resize-none bg-transparent text-sm leading-relaxed text-[#3e3021] outline-none placeholder:text-[#a69682] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5f7d59] text-white shadow-sm transition hover:bg-[#4f6b49] disabled:opacity-40"
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 hidden text-center text-[11px] text-[#a69682] sm:block">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  )
}
