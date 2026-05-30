'use client'

import { useMemo, useState } from 'react'
import type { Itinerary, PressureLevel, RouteStop, StorageState } from '@/types/travel'
import { MapView } from './MapView'

const PRESSURE_STYLES: Record<PressureLevel, string> = {
  open: 'bg-[#edf7f1] text-[#236b48] border-[#cce8d6]',
  steady: 'bg-[#fff5e8] text-[#93581c] border-[#f3d8ac]',
  tight: 'bg-[#fff0f0] text-[#a23c3c] border-[#efc3c3]',
}

interface Props {
  itinerary: Itinerary
  storageState: StorageState
}

export function ItineraryDashboard({ itinerary, storageState }: Props) {
  const [activeDay, setActiveDay] = useState(0)
  const day = itinerary.days[activeDay] ?? itinerary.days[0]

  const activeLocations = useMemo(
    () =>
      (day?.route ?? []).map((stop) => ({
        name: stop.title,
        lat: stop.coordinates.lat,
        lng: stop.coordinates.lng,
        type: stop.category,
        sequence: stop.sequence,
      })),
    [day]
  )

  const totalCost = useMemo(
    () =>
      itinerary.days.reduce(
        (sum, currentDay) =>
          sum + currentDay.route.reduce((daySum, stop) => daySum + (stop.estimatedCost ?? 0), 0),
        0
      ),
    [itinerary.days]
  )

  const totalTravel = itinerary.days.reduce((sum, currentDay) => sum + currentDay.feasibility.totalTravelMinutes, 0)

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-[#f7f6f1]">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#53736d]">Route-aware itinerary</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{itinerary.trip.destination}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {itinerary.trip.startDate} to {itinerary.trip.endDate} / {itinerary.trip.travelers}{' '}
              {itinerary.trip.travelers === 1 ? 'traveler' : 'travelers'} / {itinerary.trip.transport}
            </p>
          </div>

          <div className="grid min-w-[360px] grid-cols-3 gap-2">
            <Metric label="Feasibility" value={`${itinerary.feasibilityScore}`} detail="overall score" tone="green" />
            <Metric label="Travel" value={`${Math.round(totalTravel / 60)}h`} detail="estimated total" tone="blue" />
            <Metric label="Cost" value={`$${Math.round(totalCost)}`} detail="planned spend" tone="orange" />
          </div>
        </div>
      </header>

      <section className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(480px,0.58fr)_minmax(360px,0.42fr)]">
        <div className="flex min-w-0 flex-col overflow-hidden border-r border-slate-200">
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="max-w-3xl text-sm leading-6 text-slate-600">{itinerary.summary}</p>
              <StorageBadge storageState={storageState} />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              {itinerary.days.map((currentDay, index) => (
                <button
                  key={currentDay.day}
                  onClick={() => setActiveDay(index)}
                  className={`shrink-0 rounded-[8px] border px-4 py-2 text-left transition ${
                    activeDay === index
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-sm font-semibold">Day {currentDay.day}</span>
                  <span className="block text-xs opacity-75">{currentDay.feasibility.score} score</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {day && (
              <div className="grid gap-4">
                <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{day.date}</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-950">{day.theme}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{day.summary}</p>
                    </div>
                    <div className="rounded-[8px] border border-slate-200 px-4 py-3 text-right">
                      <p className="text-2xl font-semibold text-slate-950">{day.feasibility.score}</p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">day score</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <MiniMetric label="Stops" value={String(day.route.length)} />
                    <MiniMetric label="Travel minutes" value={String(day.feasibility.totalTravelMinutes)} />
                    <MiniMetric label="Pressure points" value={String(day.feasibility.tightStops)} />
                  </div>
                </div>

                <div className="relative grid gap-3 pl-5">
                  <div className="absolute bottom-5 left-[9px] top-5 w-px bg-slate-200" />
                  {day.route.map((stop) => (
                    <RouteStopCard key={stop.id} stop={stop} />
                  ))}
                </div>

                <div className="rounded-[8px] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Planning note</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{day.feasibility.summary}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col overflow-hidden bg-[#eef2ed]">
          <div className="border-b border-slate-200 bg-white px-5 py-4">
            <p className="text-sm font-semibold text-slate-950">Active day map</p>
            <p className="mt-1 text-xs text-slate-500">Route markers follow the scheduled stop order.</p>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <MapView center={itinerary.mapCenter} locations={activeLocations.length > 0 ? activeLocations : itinerary.keyLocations} />
          </div>
          {itinerary.tips.length > 0 && (
            <div className="border-t border-slate-200 bg-white px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trip tips</p>
              <div className="mt-3 grid gap-2">
                {itinerary.tips.slice(0, 3).map((tip, index) => (
                  <p key={index} className="rounded-[8px] bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                    {tip}
                  </p>
                ))}
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'green' | 'blue' | 'orange' }) {
  const color = {
    green: 'border-[#cce8d6] bg-[#edf7f1]',
    blue: 'border-[#cbdff0] bg-[#eef5fb]',
    orange: 'border-[#f3d8ac] bg-[#fff5e8]',
  }[tone]

  return (
    <div className={`rounded-[8px] border px-3 py-2 ${color}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function StorageBadge({ storageState }: { storageState: StorageState }) {
  const label = {
    idle: storageState.configured ? 'DynamoDB ready' : 'Storage unavailable',
    saving: 'Saving to DynamoDB',
    saved: 'Saved to DynamoDB',
    unavailable: 'DynamoDB not configured',
    error: 'DynamoDB error',
  }[storageState.status]

  return (
    <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
      {label}
    </div>
  )
}

function RouteStopCard({ stop }: { stop: RouteStop }) {
  return (
    <article className="relative rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="absolute -left-[22px] top-5 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-950">
        {stop.sequence}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-slate-950">{stop.title}</h4>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PRESSURE_STYLES[stop.pressure]}`}>
              {stop.pressure}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{stop.location}</p>
        </div>
        <div className="rounded-[8px] bg-slate-50 px-3 py-2 text-right">
          <p className="text-sm font-semibold text-slate-950">
            {stop.startTime} to {stop.endTime}
          </p>
          <p className="text-[11px] text-slate-500">{stop.durationMinutes} min stay</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{stop.description}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Travel in" value={`${stop.travelFromPreviousMinutes} min`} />
        <MiniMetric label="Category" value={stop.category} />
        <MiniMetric label="Cost" value={stop.estimatedCost ? `$${Math.round(stop.estimatedCost)}` : 'Open'} />
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">{stop.note}</p>
    </article>
  )
}
