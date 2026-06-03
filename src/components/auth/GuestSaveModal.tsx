'use client'

import { useState, FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type View = 'prompt' | 'login' | 'register'

interface Props {
  onClose: () => void
  onSave: () => void
}

export function GuestSaveModal({ onClose, onSave }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('prompt')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function switchView(next: View) {
    setError(null)
    setView(next)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    setIsLoading(false)
    if (result?.error) { setError('Invalid email or password.'); return }
    onClose()
    router.refresh()
    onSave()
  }

  async function handleGoogle() {
    await signIn('google', { callbackUrl: window.location.href })
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Registration failed.'); setIsLoading(false); return }
    const result = await signIn('credentials', { email, password, redirect: false })
    setIsLoading(false)
    if (result?.error) { setError('Account created but sign-in failed.'); return }
    onClose()
    router.refresh()
    onSave()
  }

  const inputCls = "w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
  const labelCls = "block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white rounded-3xl shadow-2xl shadow-zinc-300/60 w-full max-w-sm p-7">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* ── Prompt view ── */}
        {view === 'prompt' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl">✈️</div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-zinc-900">Save your trip</h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Create a free account to save your itinerary and access it anytime.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={() => switchView('register')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl py-3 transition"
              >
                Create account
              </button>
              <button
                onClick={() => switchView('login')}
                className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold text-sm rounded-xl py-3 transition"
              >
                Log in
              </button>
            </div>
          </div>
        )}

        {/* ── Login view ── */}
        {view === 'login' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => switchView('prompt')}
                className="text-zinc-400 hover:text-zinc-600 transition"
                aria-label="Back"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-zinc-900">Welcome back</h2>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-2.5 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              <GoogleIcon /> Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <hr className="flex-1 border-zinc-200" /> or <hr className="flex-1 border-zinc-200" />
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" className={inputCls} />
              </div>
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-sm rounded-xl py-3 transition"
              >
                {isLoading ? 'Signing in…' : 'Sign in & save trip'}
              </button>
            </form>

            <p className="text-center text-xs text-zinc-500">
              No account?{' '}
              <button onClick={() => switchView('register')} className="text-indigo-600 font-semibold hover:underline">
                Sign up
              </button>
            </p>
          </div>
        )}

        {/* ── Register view ── */}
        {view === 'register' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => switchView('prompt')}
                className="text-zinc-400 hover:text-zinc-600 transition"
                aria-label="Back"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-zinc-900">Create account</h2>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={inputCls} />
              </div>
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-sm rounded-xl py-3 transition"
              >
                {isLoading ? 'Creating account…' : 'Create account & save trip'}
              </button>
            </form>

            <p className="text-center text-xs text-zinc-500">
              Already have an account?{' '}
              <button onClick={() => switchView('login')} className="text-indigo-600 font-semibold hover:underline">
                Sign in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
