import dynamic from 'next/dynamic'
import type { KeyLocation } from '@/types/travel'

const MapViewInner = dynamic(
  () => import('./MapViewInner').then((m) => m.MapViewInner),
  { ssr: false, loading: () => <div className="h-full w-full bg-zinc-100 rounded-2xl animate-pulse" /> }
)

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
}

export function MapView({ center, locations }: Props) {
  return <MapViewInner center={center} locations={locations} />
}
