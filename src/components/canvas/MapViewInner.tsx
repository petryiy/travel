'use client'

import { useState } from 'react'
import MapboxViewInner from './MapboxViewInner'
import GoogleMapViewInner from './GoogleMapViewInner'
import type { KeyLocation } from '@/types/travel'

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
}

type MapProvider = 'mapbox' | 'google'

export function MapViewInner({ center, locations }: Props) {
  const [provider, setProvider] = useState<MapProvider>('mapbox')

  return (
    <div className="h-full w-full flex flex-col gap-2">
      <div className="flex gap-1 shrink-0">
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
      <div className="flex-1 rounded-2xl overflow-hidden">
        {provider === 'mapbox' ? (
          <MapboxViewInner center={center} locations={locations} />
        ) : (
          <GoogleMapViewInner center={center} locations={locations} />
        )}
      </div>
    </div>
  )
}
