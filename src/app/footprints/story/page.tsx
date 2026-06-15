import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { FootprintStoryExperience } from '@/components/footprints/FootprintStoryExperience'

export const dynamic = 'force-dynamic'

export default async function FootprintStoryPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  return (
    <FootprintStoryExperience userName={session.user.name ?? 'MeetU traveler'} />
  )
}
