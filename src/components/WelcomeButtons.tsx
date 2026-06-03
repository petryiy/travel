'use client'

import { useRouter } from 'next/navigation'

export function WelcomeButtons() {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <button
        onClick={() => router.push('/login')}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl py-3 transition"
      >
        Log in
      </button>
      <button
        onClick={() => router.push('/register')}
        className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 font-semibold text-sm rounded-xl py-3 transition"
      >
        Sign up
      </button>
      <button
        onClick={() => router.push('/guest')}
        className="w-full text-zinc-500 hover:text-zinc-700 text-sm font-medium py-2 transition"
      >
        Continue without login
      </button>
    </div>
  )
}
