'use client'

import { useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'
import { UserMenu } from '@/components/auth/UserMenu'
import { GuestSaveModal } from '@/components/auth/GuestSaveModal'

interface Props {
  userId: string | null
  userName: string | null
  userImage: string | null
}

export function HomeClient({ userId, userName, userImage }: Props) {
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [presentationMode, setPresentationMode] = useState<'overview' | 'edit'>('edit')

  const {
    messages,
    canvasState,
    itinerary,
    clarification,
    isLoading,
    savedTripId,
    savedTripTitle,
    savedTrips,
    isSaving,
    isLoadingTrips,
    saveStatus,
    saveError,
    submitSetup,
    sendMessage,
    saveCurrentTrip,
    openSavedTrip,
    renameSavedTripTitle,
    retry,
  } = useChat(userId)

  function handleSave() {
    if (!userId) {
      setShowGuestModal(true)
      return
    }
    void saveCurrentTrip()
  }

  return (
    <>
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
            savedTripTitle={savedTripTitle}
            savedTrips={savedTrips}
            isSaving={isSaving}
            isLoadingTrips={isLoadingTrips}
            saveStatus={saveStatus}
            saveError={saveError}
            presentationMode={presentationMode}
            onSetup={submitSetup}
            onSend={sendMessage}
            onSave={handleSave}
            onOpenSavedTrip={openSavedTrip}
            onRenameSavedTrip={renameSavedTripTitle}
            onPresentationModeChange={setPresentationMode}
            onBackToDashboard={() => {}}
            onRetry={retry}
          />
        </div>
      </div>

      {showGuestModal && (
        <GuestSaveModal
          onClose={() => setShowGuestModal(false)}
          onSave={() => void saveCurrentTrip()}
        />
      )}
    </>
  )
}
