'use client'

import { useChat } from '@/hooks/useChat'
import { ImmersiveExperience } from '@/components/canvas/ImmersiveExperience'

export default function Home() {
  const { canvasState, itinerary, locationFocus, clarification, isLoading, storageState, sendMessage, resetSession } = useChat()

  return (
    <ImmersiveExperience
      canvasState={canvasState}
      itinerary={itinerary}
      locationFocus={locationFocus}
      clarification={clarification}
      isLoading={isLoading}
      storageState={storageState}
      onSend={sendMessage}
      onReset={resetSession}
    />
  )
}
