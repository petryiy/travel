'use client'

import { useState } from 'react'
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { KeyLocation } from '@/types/travel'

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
}

const TYPE_EMOJI: Record<string, string> = {
  attraction: '🏛️',
  food: '🍽️',
  accommodation: '🏨',
  activity: '🎯',
  transport: '🚉',
}

export default function MapboxViewInner({ center, locations }: Props) {
  const [popupIndex, setPopupIndex] = useState<number | null>(null)
  const activePopup = popupIndex === null ? null : locations[popupIndex]

  return (
    <Map
      key={`${center.lat.toFixed(4)}-${center.lng.toFixed(4)}`}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 12 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
    >
      <NavigationControl position="top-right" />

      {locations.map((loc, i) => (
        <Marker
          key={`${loc.day ?? 'trip'}-${loc.order ?? i}-${loc.name}`}
          longitude={loc.lng}
          latitude={loc.lat}
          anchor="bottom"
          onClick={(e) => { e.originalEvent.stopPropagation(); setPopupIndex(i) }}
        >
          <div
            className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-white shadow-md flex items-center justify-center text-sm cursor-pointer hover:scale-110 transition-transform"
            title={loc.name}
          >
            {loc.order ?? TYPE_EMOJI[loc.type ?? ''] ?? '📍'}
          </div>
        </Marker>
      ))}

      {activePopup && (
        <Popup
          longitude={activePopup.lng}
          latitude={activePopup.lat}
          anchor="top"
          onClose={() => setPopupIndex(null)}
          closeOnClick={false}
        >
          <div className="text-sm">
            <p className="font-semibold text-zinc-900">{activePopup.name}</p>
            {activePopup.title && (
              <p className="text-xs text-zinc-600 mt-0.5">{activePopup.title}</p>
            )}
            {(activePopup.time || activePopup.type) && (
              <p className="text-xs text-zinc-500 capitalize mt-0.5">
                {[activePopup.time, activePopup.type].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </Popup>
      )}
    </Map>
  )
}
