'use client'

import { useState, FormEvent } from 'react'
import type { TripDetails, TripStyle } from '@/types/travel'

const STYLES: { value: TripStyle; label: string; emoji: string; desc: string }[] = [
  { value: 'relax', label: 'Relax', emoji: '🌴', desc: 'Beaches, spas & slow mornings' },
  { value: 'culture', label: 'Culture', emoji: '🏛️', desc: 'Museums, history & local life' },
  { value: 'adventure', label: 'Adventure', emoji: '🧗', desc: 'Hikes, thrills & the outdoors' },
  { value: 'mixed', label: 'Mixed', emoji: '✨', desc: 'A little bit of everything' },
]

interface Props {
  onSubmit: (details: TripDetails) => void
}

export function SetupForm({ onSubmit }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [travelers, setTravelers] = useState(2)
  const [style, setStyle] = useState<TripStyle>('mixed')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!destination.trim() || !startDate || !endDate) return
    onSubmit({ destination: destination.trim(), startDate, endDate, travelers, style })
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✈️</div>
          <h1 className="text-2xl font-bold text-zinc-900">Plan your next trip</h1>
          <p className="text-zinc-500 text-sm mt-1.5">Tell us the basics and Gemini will do the rest</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl shadow-zinc-200/60 p-7 space-y-5">
          {/* Destination */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Destination
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Tokyo, Paris, Bali…"
              required
              className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Travelers */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
              Travelers
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTravelers((n) => Math.max(1, n - 1))}
                className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition text-lg font-light"
              >
                −
              </button>
              <span className="text-zinc-900 font-semibold text-lg w-6 text-center">{travelers}</span>
              <button
                type="button"
                onClick={() => setTravelers((n) => Math.min(10, n + 1))}
                className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition text-lg font-light"
              >
                +
              </button>
              <span className="text-sm text-zinc-400 ml-1">{travelers === 1 ? 'person' : 'people'}</span>
            </div>
          </div>

          {/* Trip style */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Trip style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition ${
                    style === s.value
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <span className="text-xl leading-none mt-0.5">{s.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{s.label}</p>
                    <p className="text-xs text-zinc-400 leading-snug">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!destination.trim() || !startDate || !endDate}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-sm rounded-xl py-3 transition"
          >
            Start planning →
          </button>
        </form>
      </div>
    </div>
  )
}
