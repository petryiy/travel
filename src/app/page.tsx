import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/LandingPage'

export default async function WelcomePage() {
  const session = await auth()
  if (session?.user?.id) redirect('/dashboard')

  return <LandingPage />
}
