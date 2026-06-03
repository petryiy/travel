'use client'

import { signOut } from 'next-auth/react'
import Image from 'next/image'

interface Props {
  name: string | null
  image: string | null
}

export function UserMenu({ name, image }: Props) {
  return (
    <div className="flex items-center gap-3">
      {image ? (
        <Image
          src={image}
          alt={name ?? 'User'}
          width={28}
          height={28}
          className="rounded-full border border-zinc-200"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      {name && (
        <span className="text-sm text-zinc-700 font-medium hidden sm:block">{name}</span>
      )}
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="text-xs text-zinc-500 hover:text-zinc-800 transition border border-zinc-200 rounded-lg px-3 py-1.5"
      >
        Sign out
      </button>
    </div>
  )
}
