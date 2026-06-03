'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LandingPage } from '@/components/LandingPage'

function LoginPageInner() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  return <LandingPage initialView="login" callbackUrl={callbackUrl} />
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LandingPage initialView="login" />}>
      <LoginPageInner />
    </Suspense>
  )
}
