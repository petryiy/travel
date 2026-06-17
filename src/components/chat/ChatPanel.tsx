'use client'

import { useState } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { Message } from '@/types/travel'

interface Props {
  messages: Message[]
  isLoading: boolean
  onSend: (text: string) => void
  hasItinerary?: boolean
  onBackToDashboard?: () => void
}

export function ChatPanel({ messages, isLoading, onSend, hasItinerary = false, onBackToDashboard }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobileLarge, setIsMobileLarge] = useState(false)

  const subtitle = hasItinerary ? 'Refine the plan with MeetU' : 'Start with the trip basics'

  const desktopPanel = isCollapsed ? (
    <div className="hidden h-auto min-h-0 w-[76px] shrink-0 flex-col justify-start gap-3 border-r border-[#dfd4c5] bg-[#fbf7ef] px-2 py-3 lg:flex">
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="inline-flex h-auto w-full min-w-0 items-center gap-2 rounded-2xl border border-[#d8c9b5] bg-[#fffaf1] px-2 py-2 text-sm font-bold text-[#3e3021] shadow-sm transition hover:border-[#bca98d] hover:bg-white lg:flex-col"
        title="Ask MeetU"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#3f5f4c] text-sm font-bold text-[#fffaf0]">M</span>
        <span className="truncate lg:[writing-mode:vertical-rl] lg:rotate-180">Ask MeetU</span>
      </button>
    </div>
  ) : (
    <div className="hidden h-auto min-h-0 w-[360px] shrink-0 flex-col border-r border-[#dfd4c5] bg-[#f6efe3] lg:flex">
      <div className="border-b border-[#dfd4c5] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#3f5f4c] text-sm font-bold text-[#fffaf0] shadow-sm">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#35291d]">Ask MeetU</p>
              <p className="truncate text-xs text-[#8a7965]">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="shrink-0 rounded-full border border-[#d6c9b8] bg-[#fffaf1] px-2.5 py-1.5 text-xs font-semibold text-[#66523b] shadow-sm transition hover:border-[#bda98d] hover:bg-white"
          >
            Collapse
          </button>
        </div>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={onSend} disabled={isLoading} hasItinerary={hasItinerary} />
    </div>
  )

  if (hasItinerary) {
    return (
      <>
        {desktopPanel}

        <div className="lg:hidden">
          {isMobileOpen && (
            <button
              type="button"
              aria-label="Close Ask MeetU"
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-40 bg-[#2f2419]/18 backdrop-blur-[1px]"
            />
          )}

          {isMobileOpen ? (
            <div
              className={`fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex min-h-[360px] flex-col overflow-hidden rounded-[28px] border border-[#d8c9b5] bg-[#f6efe3] shadow-[0_24px_70px_rgba(54,39,22,0.28)] transition-[height] duration-300 ${
                isMobileLarge ? 'h-[82dvh]' : 'h-[58dvh]'
              }`}
            >
              <div className="shrink-0 border-b border-[#dfd4c5] bg-[#fbf7ef] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#3f5f4c] text-sm font-bold text-[#fffaf0] shadow-sm">
                      M
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#35291d]">Ask MeetU</p>
                      <p className="truncate text-xs text-[#8a7965]">{subtitle}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsMobileLarge((value) => !value)}
                      className="rounded-full border border-[#d6c9b8] bg-[#fffaf1] px-2.5 py-1.5 text-xs font-semibold text-[#66523b] shadow-sm transition hover:border-[#bda98d] hover:bg-white"
                    >
                      {isMobileLarge ? 'Small' : 'Large'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMobileOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d6c9b8] bg-[#fffaf1] text-lg leading-none text-[#66523b] shadow-sm transition hover:border-[#bda98d] hover:bg-white"
                      aria-label="Close Ask MeetU"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <MessageList messages={messages} isLoading={isLoading} />
              <ChatInput onSend={onSend} disabled={isLoading} hasItinerary={hasItinerary} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2 rounded-full border border-[#d8c9b5] bg-[#fffaf1] px-3 py-2.5 text-sm font-bold text-[#35291d] shadow-[0_16px_42px_rgba(54,39,22,0.22)] transition hover:-translate-y-0.5 hover:bg-white"
              aria-label="Open Ask MeetU"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3f5f4c] text-sm text-[#fffaf0] shadow-sm">M</span>
              <span className="pr-1">Ask</span>
            </button>
          )}
        </div>
      </>
    )
  }

  if (isCollapsed) {
    return (
      <div className="flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b border-[#dfd4c5] bg-[#fbf7ef] px-3 lg:h-auto lg:min-h-0 lg:w-[76px] lg:flex-col lg:justify-start lg:border-b-0 lg:border-r lg:px-2 lg:py-3">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-[#d8c9b5] bg-[#fffaf1] px-3 py-2 text-sm font-bold text-[#3e3021] shadow-sm transition hover:border-[#bca98d] hover:bg-white lg:h-auto lg:w-full lg:flex-col lg:px-2"
          title="Ask MeetU"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#3f5f4c] text-sm font-bold text-[#fffaf0]">M</span>
          <span className="truncate lg:[writing-mode:vertical-rl] lg:rotate-180">Ask MeetU</span>
        </button>
        {onBackToDashboard && !hasItinerary && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="shrink-0 rounded-full border border-[#d6c9b8] bg-[#fffaf1] px-3 py-1.5 text-xs font-semibold text-[#66523b] shadow-sm transition hover:border-[#bda98d] hover:bg-white lg:hidden"
          >
            Dashboard
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[42dvh] min-h-[260px] w-full shrink-0 flex-col border-b border-[#dfd4c5] bg-[#f6efe3] lg:h-auto lg:min-h-0 lg:w-[360px] lg:border-b-0 lg:border-r">
      <div className="border-b border-[#dfd4c5] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#3f5f4c] text-sm font-bold text-[#fffaf0] shadow-sm">
              M
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#35291d]">Ask MeetU</p>
              <p className="truncate text-xs text-[#8a7965]">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasItinerary && (
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="shrink-0 rounded-full border border-[#d6c9b8] bg-[#fffaf1] px-2.5 py-1.5 text-xs font-semibold text-[#66523b] shadow-sm transition hover:border-[#bda98d] hover:bg-white"
              >
                Collapse
              </button>
            )}
            {onBackToDashboard && !hasItinerary && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="shrink-0 rounded-full border border-[#d6c9b8] bg-[#fffaf1] px-2.5 py-1.5 text-xs font-semibold text-[#66523b] shadow-sm transition hover:border-[#bda98d] hover:bg-white sm:px-3"
            >
              Dashboard
            </button>
            )}
          </div>
        </div>
      </div>

      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={onSend} disabled={isLoading} hasItinerary={hasItinerary} />
    </div>
  )
}
