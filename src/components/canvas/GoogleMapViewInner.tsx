'use client'

import { useState, useCallback } from 'react'
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
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), [])
  const onUnmount = useCallback(() => setMap(null), [])

  if (!isLoaded) {
    return <div className="h-full w-full bg-zinc-100 animate-pulse rounded-2xl" />
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={12}
      options={MAP_OPTIONS}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={() => setActiveIndex(null)}
    >
      {locations.map((loc, i) => (
        <Marker
          key={i}
          position={{ lat: loc.lat, lng: loc.lng }}
          title={loc.name}
          onClick={() => setActiveIndex(i)}
        />
      ))}

      {activeIndex !== null && (
        <InfoWindow
          position={{ lat: locations[activeIndex].lat, lng: locations[activeIndex].lng }}
          onCloseClick={() => setActiveIndex(null)}
        >
          <div className="text-sm">
            <p className="font-semibold text-zinc-900">{locations[activeIndex].name}</p>
            {locations[activeIndex].type && (
              <p className="text-xs text-zinc-500 capitalize mt-0.5">{locations[activeIndex].type}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
