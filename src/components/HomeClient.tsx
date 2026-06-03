'use client'

import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'
import { UserMenu } from '@/components/auth/UserMenu'

interface Props {
  userId: string
  userName: string | null
  userImage: string | null
}

export function HomeClient({ userId, userName, userImage }: Props) {
  const {
    messages,
    canvasState,
    itinerary,
    clarification,
    isLoading,
    savedTripId,
    savedTrips,
    isSaving,
    isLoadingTrips,
    saveStatus,
    saveError,
    submitSetup,
    sendMessage,
    saveCurrentTrip,
    openSavedTrip,
  } = useChat(userId)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-white shrink-0">
        <span className="text-sm font-semibold text-zinc-900">Travel Planner</span>
        <UserMenu name={userName} image={userImage} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          hasItinerary={Boolean(itinerary)}
        />
        <CanvasPanel
          canvasState={canvasState}
          itinerary={itinerary}
          clarification={clarification}
          isLoading={isLoading}
          savedTripId={savedTripId}
          savedTrips={savedTrips}
          isSaving={isSaving}
          isLoadingTrips={isLoadingTrips}
          saveStatus={saveStatus}
          saveError={saveError}
          onSetup={submitSetup}
          onSend={sendMessage}
          onSave={saveCurrentTrip}
          onOpenSavedTrip={openSavedTrip}
        />
      </div>
    </div>
  )
}
