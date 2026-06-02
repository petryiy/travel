'use client'

import { useState } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import type { KeyLocation } from '@/types/travel'

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
}

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: true,
  fullscreenControl: false,
}

export default function GoogleMapViewInner({ center, locations }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
  })

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeLocation = activeIndex === null ? null : locations[activeIndex]

  if (!isLoaded) {
    return <div className="h-full w-full bg-zinc-100 animate-pulse rounded-2xl" />
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={12}
      options={MAP_OPTIONS}
      onClick={() => setActiveIndex(null)}
    >
      {locations.map((loc, i) => (
        <Marker
          key={`${loc.day ?? 'trip'}-${loc.order ?? i}-${loc.name}`}
          position={{ lat: loc.lat, lng: loc.lng }}
          title={loc.name}
          label={loc.order ? { text: String(loc.order), color: 'white', fontWeight: '700' } : undefined}
          onClick={() => setActiveIndex(i)}
        />
      ))}

      {activeLocation && (
        <InfoWindow
          position={{ lat: activeLocation.lat, lng: activeLocation.lng }}
          onCloseClick={() => setActiveIndex(null)}
        >
          <div className="text-sm">
            <p className="font-semibold text-zinc-900">{activeLocation.name}</p>
            {activeLocation.title && (
              <p className="text-xs text-zinc-600 mt-0.5">{activeLocation.title}</p>
            )}
            {(activeLocation.startTime || activeLocation.endTime) && (
              <p className="text-xs font-medium text-indigo-600 mt-0.5">
                {[activeLocation.startTime, activeLocation.endTime].filter(Boolean).join(' - ')}
              </p>
            )}
            {(activeLocation.time || activeLocation.type) && (
              <p className="text-xs text-zinc-500 capitalize mt-0.5">
                {[activeLocation.time, activeLocation.type].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
