'use client'

import Image from 'next/image'
import type { TripPresence } from '@/types/travel'

interface Props {
  presence: TripPresence[]
  myUserId: string | null
  max?: number
}

function initial(name: string | null) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

export function PresenceStack({ presence, myUserId, max = 4 }: Props) {
  const others = presence.filter((p) => p.userId !== myUserId)
  if (others.length === 0) return null

  const shown = others.slice(0, max)
  const extra = others.length - shown.length

  return (
    <div className="flex items-center -space-x-2" title={`${others.length} other${others.length === 1 ? '' : 's'} viewing`}>
      {shown.map((person) =>
        person.userImage ? (
          <Image
            key={person.userId}
            src={person.userImage}
            alt={person.userName ?? 'Collaborator'}
            width={26}
            height={26}
            className="h-[26px] w-[26px] rounded-full border-2 border-[#fffaf1] object-cover"
          />
        ) : (
          <span
            key={person.userId}
            title={person.userName ?? 'Collaborator'}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-[#fffaf1] bg-[#e3efe2] text-xs font-bold text-[#496248]"
          >
            {initial(person.userName)}
          </span>
        )
      )}
      {extra > 0 && (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-[#fffaf1] bg-[#efe7d8] text-[10px] font-bold text-[#7d6c58]">
          +{extra}
        </span>
      )}
    </div>
  )
}
