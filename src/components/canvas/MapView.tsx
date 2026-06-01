import dynamic from 'next/dynamic'
import type { KeyLocation } from '@/types/travel'

const MapViewInner = dynamic(
  () => import('./MapViewInner').then((m) => m.MapViewInner),
  { ssr: false, loading: () => <div className="h-full w-full bg-zinc-100 rounded-2xl animate-pulse" /> }
)

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
  activeDay?: number | null
}

export function MapView({ center, locations, activeDay }: Props) {
  return <MapViewInner center={center} locations={locations} activeDay={activeDay} />
}
