import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { FootprintsExperience } from '@/components/footprints/FootprintsExperience'

export const dynamic = 'force-dynamic'

export default async function FootprintsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  return (
    <FootprintsExperience userName={session.user.name ?? 'MeetU traveler'} />
  )
}
