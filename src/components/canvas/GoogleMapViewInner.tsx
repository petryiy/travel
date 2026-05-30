'use client'

import { useCallback, useState } from 'react'
import { GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
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
  const hasKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY)
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'missing-key',
  })

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const onLoad = useCallback((nextMap: google.maps.Map) => setMap(nextMap), [])
  const onUnmount = useCallback(() => setMap(null), [])
  void map

  if (!hasKey) {
    return (
      <div className="grid h-full w-full place-items-center rounded-[8px] bg-slate-100 p-6 text-center text-sm leading-6 text-slate-500">
        Add a Google Maps key to enable the Google map view.
      </div>
    )
  }

  if (!isLoaded) {
    return <div className="h-full w-full animate-pulse rounded-[8px] bg-slate-100" />
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
      {locations.length > 1 && (
        <Polyline
          path={locations.map((location) => ({ lat: location.lat, lng: location.lng }))}
          options={{ strokeColor: '#276f65', strokeOpacity: 0.72, strokeWeight: 4 }}
        />
      )}

      {locations.map((location, index) => (
        <Marker
          key={`${location.name}-${index}`}
          position={{ lat: location.lat, lng: location.lng }}
          title={location.name}
          label={String(location.sequence ?? index + 1)}
          onClick={() => setActiveIndex(index)}
        />
      ))}

      {activeIndex !== null && locations[activeIndex] && (
        <InfoWindow
          position={{ lat: locations[activeIndex].lat, lng: locations[activeIndex].lng }}
          onCloseClick={() => setActiveIndex(null)}
        >
          <div className="text-sm">
            <p className="font-semibold text-slate-950">{locations[activeIndex].name}</p>
            {locations[activeIndex].type && (
              <p className="mt-0.5 text-xs capitalize text-slate-500">{locations[activeIndex].type}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
