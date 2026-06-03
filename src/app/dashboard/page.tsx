import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { HomeClient } from '@/components/HomeClient'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  return (
    <HomeClient
      userId={session.user.id}
      userName={session.user.name ?? null}
      userImage={session.user.image ?? null}
    />
  )
}
