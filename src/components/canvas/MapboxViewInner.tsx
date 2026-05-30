'use client'

import { useMemo, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Popup, Source } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { KeyLocation } from '@/types/travel'

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
}

export default function MapboxViewInner({ center, locations }: Props) {
  const [popupIndex, setPopupIndex] = useState<number | null>(null)

  const routeData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features:
        locations.length > 1
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: locations.map((location) => [location.lng, location.lat]),
                },
              },
            ]
          : [],
    }),
    [locations]
  )

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return <FallbackMap locations={locations} />
  }

  return (
    <Map
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 12 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
    >
      <NavigationControl position="top-right" />

      {locations.length > 1 && (
        <Source id="active-route" type="geojson" data={routeData}>
          <Layer
            id="active-route-line"
            type="line"
            paint={{
              'line-color': '#00ffd1',
              'line-width': 4,
              'line-opacity': 0.72,
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
        </Source>
      )}

      {locations.map((location, index) => (
        <Marker
          key={`${location.name}-${index}`}
          longitude={location.lng}
          latitude={location.lat}
          anchor="bottom"
          onClick={(event) => {
            event.originalEvent.stopPropagation()
            setPopupIndex(index)
          }}
        >
          <div
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-cyan-100 bg-cyan-300 text-xs font-semibold text-slate-950 shadow-[0_0_28px_rgba(0,255,209,0.65)] transition-transform hover:scale-110"
            title={location.name}
          >
            {location.sequence ?? index + 1}
          </div>
        </Marker>
      ))}

      {popupIndex !== null && locations[popupIndex] && (
        <Popup
          longitude={locations[popupIndex].lng}
          latitude={locations[popupIndex].lat}
          anchor="top"
          onClose={() => setPopupIndex(null)}
          closeOnClick={false}
        >
          <div className="text-sm">
            <p className="font-semibold text-slate-950">{locations[popupIndex].name}</p>
            {locations[popupIndex].type && (
              <p className="mt-0.5 text-xs capitalize text-slate-500">{locations[popupIndex].type}</p>
            )}
          </div>
        </Popup>
      )}
    </Map>
  )
}

function FallbackMap({ locations }: { locations: KeyLocation[] }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[8px] bg-slate-950">
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(0,255,209,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,209,0.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute left-[10%] top-[16%] h-[46%] w-[72%] rounded-full border border-cyan-300/20" />
      <div className="absolute bottom-[12%] right-[8%] h-[34%] w-[46%] rounded-full border border-fuchsia-300/20" />
      {locations.slice(0, 6).map((location, index) => (
        <div
          key={`${location.name}-${index}`}
          className="absolute grid h-9 w-9 place-items-center rounded-full border-2 border-cyan-100 bg-cyan-300 text-xs font-semibold text-slate-950 shadow-[0_0_28px_rgba(0,255,209,0.65)]"
          style={{
            left: `${18 + ((index * 17) % 62)}%`,
            top: `${24 + ((index * 13) % 48)}%`,
          }}
          title={location.name}
        >
          {location.sequence ?? index + 1}
        </div>
      ))}
      <div className="absolute bottom-4 left-4 right-4 rounded-[8px] border border-cyan-300/20 bg-slate-950/85 p-3 text-xs leading-5 text-cyan-100/70 shadow-sm">
        Add a Mapbox token to render live maps. The itinerary and route order are still available.
      </div>
    </div>
  )
}
