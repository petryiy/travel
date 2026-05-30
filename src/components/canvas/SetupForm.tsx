'use client'

import { FormEvent, useState } from 'react'
import type { BudgetLevel, Pace, TransportMode, TripDetails, TripStyle } from '@/types/travel'

const STYLES: { value: TripStyle; label: string; desc: string }[] = [
  { value: 'mixed', label: 'Balanced', desc: 'Landmarks, food, and local texture' },
  { value: 'relaxed', label: 'Relaxed', desc: 'Slower days with more buffer' },
  { value: 'culture', label: 'Culture', desc: 'Museums, heritage, and neighborhoods' },
  { value: 'food', label: 'Food', desc: 'Restaurants, markets, and cafes' },
  { value: 'adventure', label: 'Adventure', desc: 'Outdoor time and active routes' },
]

const PACE: { value: Pace; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'packed', label: 'Packed' },
]

const BUDGET: { value: BudgetLevel; label: string }[] = [
  { value: 'lean', label: 'Lean' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'premium', label: 'Premium' },
]

const TRANSPORT: { value: TransportMode; label: string }[] = [
  { value: 'transit', label: 'Transit' },
  { value: 'walking', label: 'Walking' },
  { value: 'driving', label: 'Driving' },
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
  const [pace, setPace] = useState<Pace>('balanced')
  const [budget, setBudget] = useState<BudgetLevel>('balanced')
  const [transport, setTransport] = useState<TransportMode>('transit')
  const [homeBase, setHomeBase] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget as HTMLFormElement)
    const nextDestination = String(formData.get('destination') ?? destination).trim()
    const nextStartDate = String(formData.get('startDate') ?? startDate)
    const nextEndDate = String(formData.get('endDate') ?? endDate)
    const nextHomeBase = String(formData.get('homeBase') ?? homeBase).trim()

    if (!nextDestination || !nextStartDate || !nextEndDate) return

    onSubmit({
      destination: nextDestination,
      startDate: nextStartDate,
      endDate: nextEndDate,
      travelers,
      style,
      pace,
      budget,
      transport,
      homeBase: nextHomeBase || undefined,
    })
  }

  return (
    <div className="flex flex-1 overflow-y-auto bg-[#f7f6f1]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-8 py-10 lg:grid-cols-[0.82fr_1fr]">
        <section className="flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#53736d]">AI travel copilot</p>
          <h1 className="mt-4 max-w-lg text-5xl font-semibold leading-[1.02] tracking-normal text-slate-950">
            Build a trip plan that can survive the real day.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            AtlasLoop turns a traveler brief into a route-aware itinerary with scheduled stops, realistic buffers,
            feasibility checks, and DynamoDB-backed saved plans.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div className="border-l-2 border-[#327c72] pl-3">
              <p className="text-2xl font-semibold text-slate-950">AI</p>
              <p className="mt-1 text-xs text-slate-500">Conversational planning</p>
            </div>
            <div className="border-l-2 border-[#b86f3d] pl-3">
              <p className="text-2xl font-semibold text-slate-950">Score</p>
              <p className="mt-1 text-xs text-slate-500">Feasibility checks</p>
            </div>
            <div className="border-l-2 border-[#46698f] pl-3">
              <p className="text-2xl font-semibold text-slate-950">AWS</p>
              <p className="mt-1 text-xs text-slate-500">DynamoDB storage</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">Trip brief</p>
              <p className="mt-1 text-sm text-slate-500">Start with the essentials. You can refine the plan in chat.</p>
            </div>
            <div className="rounded-full bg-[#e9f3f1] px-3 py-1 text-xs font-semibold text-[#256b61]">New plan</div>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destination</span>
              <input
                type="text"
                name="destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Tokyo, Sydney, Paris"
                required
                className="h-11 rounded-[8px] border border-slate-200 px-3 text-sm text-slate-950 outline-none transition focus:border-[#327c72] focus:ring-2 focus:ring-[#327c72]/15"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</span>
                <input
                  type="date"
                  name="startDate"
                  value={startDate}
                  min={today}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  className="h-11 rounded-[8px] border border-slate-200 px-3 text-sm text-slate-950 outline-none transition focus:border-[#327c72] focus:ring-2 focus:ring-[#327c72]/15"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">End date</span>
                <input
                  type="date"
                  name="endDate"
                  value={endDate}
                  min={startDate || today}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                  className="h-11 rounded-[8px] border border-slate-200 px-3 text-sm text-slate-950 outline-none transition focus:border-[#327c72] focus:ring-2 focus:ring-[#327c72]/15"
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred base</span>
              <input
                type="text"
                name="homeBase"
                value={homeBase}
                onChange={(event) => setHomeBase(event.target.value)}
                placeholder="Optional hotel, district, or neighborhood"
                className="h-11 rounded-[8px] border border-slate-200 px-3 text-sm text-slate-950 outline-none transition focus:border-[#327c72] focus:ring-2 focus:ring-[#327c72]/15"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Travelers</span>
                <div className="flex h-11 items-center rounded-[8px] border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTravelers((value) => Math.max(1, value - 1))}
                    className="h-full w-11 border-r border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                    aria-label="Decrease travelers"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center text-sm font-semibold text-slate-950">{travelers}</span>
                  <button
                    type="button"
                    onClick={() => setTravelers((value) => Math.min(10, value + 1))}
                    className="h-full w-11 border-l border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                    aria-label="Increase travelers"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transport</span>
                <div className="grid h-11 grid-cols-3 rounded-[8px] border border-slate-200 p-1">
                  {TRANSPORT.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTransport(option.value)}
                      className={`rounded-[6px] text-xs font-semibold transition ${
                        transport === option.value ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trip style</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {STYLES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStyle(option.value)}
                    className={`rounded-[8px] border p-3 text-left transition ${
                      style === option.value
                        ? 'border-[#327c72] bg-[#eef7f5]'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-950">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SegmentedControl label="Pace" value={pace} options={PACE} onChange={setPace} />
              <SegmentedControl label="Budget" value={budget} options={BUDGET} onChange={setBudget} />
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 h-12 w-full rounded-[8px] bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-[#276f65]"
          >
            Generate itinerary
          </button>
        </form>
      </div>
    </div>
  )
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="grid h-11 grid-cols-3 rounded-[8px] border border-slate-200 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-[6px] text-xs font-semibold transition ${
              value === option.value ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
