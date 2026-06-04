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

export function MapViewInner({ center, locations, activeDay }: Props) {
  // Mapbox is the primary provider. We only fall back to Google Maps when
  // Mapbox can't work — its token is missing, or it throws a runtime error
  // (bad/expired token, tiles failing to load, etc.).
  const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
  const [mapboxFailed, setMapboxFailed] = useState(false)
  const useGoogle = !hasMapboxToken || mapboxFailed

  const locationKey = locations
    .map((location) => `${location.day ?? 'trip'}:${location.order ?? ''}:${location.startTime ?? ''}:${location.endTime ?? ''}:${location.name}:${location.lat}:${location.lng}`)
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

        {useGoogle && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-600">
            Google Maps fallback
          </span>
        )}
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden">
        {useGoogle ? (
          <GoogleMapViewInner key={`google-${locationKey}`} center={center} locations={locations} />
        ) : (
          <MapboxViewInner
            key={`mapbox-${locationKey}`}
            center={center}
            locations={locations}
            onError={() => setMapboxFailed(true)}
          />
        )}
      </div>
    </div>
  )
}
