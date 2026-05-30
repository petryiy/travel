import dynamic from 'next/dynamic'
import type { KeyLocation } from '@/types/travel'

const MapViewInner = dynamic(
  () => import('./MapViewInner').then((m) => m.MapViewInner),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-[8px] bg-slate-100" /> }
)

interface Props {
  center: { lat: number; lng: number }
  locations: KeyLocation[]
}

export function MapView({ center, locations }: Props) {
  return <MapViewInner center={center} locations={locations} />
}
