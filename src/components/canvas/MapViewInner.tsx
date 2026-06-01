'use client'

import { useState } from 'react'
import MapboxViewInner from './MapboxViewInner'
import GoogleMapViewInner from './GoogleMapViewInner'
import type { KeyLocation } from '@/types/travel'

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
  activeDay?: number | null
}

type MapProvider = 'mapbox' | 'google'

export function MapViewInner({ center, locations, activeDay }: Props) {
  const [provider, setProvider] = useState<MapProvider>('mapbox')
  const locationKey = locations
    .map((location) => `${location.day ?? 'trip'}:${location.order ?? ''}:${location.name}:${location.lat}:${location.lng}`)
    .join('|')

  return (
    <div className="h-full w-full flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-900">
            {activeDay ? `Day ${activeDay}` : 'Trip'} map
          </p>
          <p className="text-[11px] text-zinc-400">
            {locations.length} {locations.length === 1 ? 'place' : 'places'}
          </p>
        </div>

        <div className="flex gap-1">
          {(['mapbox', 'google'] as MapProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                provider === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              {p === 'mapbox' ? 'Mapbox' : 'Google Maps'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden">
        {provider === 'mapbox' ? (
          <MapboxViewInner key={`mapbox-${locationKey}`} center={center} locations={locations} />
        ) : (
          <GoogleMapViewInner key={`google-${locationKey}`} center={center} locations={locations} />
        )}
      </div>
    </div>
  )
}
