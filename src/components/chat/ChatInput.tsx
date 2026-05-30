'use client'

import { KeyboardEvent, useRef, useState } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  function handleInput() {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 150)}px`
  }

  return (
    <div className="border-t border-cyan-300/15 px-4 py-3">
      <div className="flex items-end gap-2 rounded-[8px] border border-cyan-300/20 bg-slate-900/80 px-3 py-2 shadow-[0_0_30px_rgba(0,255,209,0.08)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder="Transmit your travel signal."
          rows={1}
          className="max-h-40 flex-1 resize-none bg-transparent text-sm leading-6 text-cyan-50 outline-none placeholder:text-cyan-200/35 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="mb-0.5 h-8 shrink-0 rounded-[6px] border border-cyan-300/40 bg-cyan-300/15 px-3 text-xs font-semibold text-cyan-50 transition-colors hover:bg-cyan-300/25 disabled:opacity-40"
          aria-label="Send message"
        >
          Send
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-cyan-200/35">Press Enter to send. Use Shift+Enter for a new line.</p>
    </div>
  )
}
