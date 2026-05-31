'use client'

import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'

export default function Home() {
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
  } = useChat()

  return (
    <div className="flex h-full overflow-hidden">
      <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} />
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
  )
}
