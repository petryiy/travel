'use client'

import { useState } from 'react'
import type { KeyLocation } from '@/types/travel'
import GoogleMapViewInner from './GoogleMapViewInner'
import MapboxViewInner from './MapboxViewInner'

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
}

type MapProvider = 'mapbox' | 'google'

export function MapViewInner({ center, locations }: Props) {
  const [provider, setProvider] = useState<MapProvider>('mapbox')

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="grid h-10 shrink-0 grid-cols-2 rounded-[8px] border border-slate-200 bg-white p-1">
        {(['mapbox', 'google'] as MapProvider[]).map((option) => (
          <button
            key={option}
            onClick={() => setProvider(option)}
            className={`rounded-[6px] text-xs font-semibold transition ${
              provider === option ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {option === 'mapbox' ? 'Mapbox' : 'Google Maps'}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-[8px] border border-slate-200 bg-white">
        {provider === 'mapbox' ? (
          <MapboxViewInner center={center} locations={locations} />
        ) : (
          <GoogleMapViewInner center={center} locations={locations} />
        )}
      </div>
    </div>
  )
}
