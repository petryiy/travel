'use client'

import { useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { UserMenu } from '@/components/auth/UserMenu'
import { GuestSaveModal } from '@/components/auth/GuestSaveModal'
import { ShareModal } from '@/components/collaboration/ShareModal'

interface Props {
  userId: string | null
  userName: string | null
  userImage: string | null
}

export function HomeClient({ userId, userName, userImage }: Props) {
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [view, setView] = useState<'dashboard' | 'planner'>('dashboard')
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
    startNewTrip,
    sendMessage,
    updateItinerary,
    saveCurrentTrip,
    openSavedTrip,
    renameSavedTripTitle,
    updateSavedTripPublishStatus,
    deleteSavedTrip,
    retry,
    savedTripIsPublished,
    tripRole,
    collaborators,
    collaboratorsCanManage,
    isLoadingCollaborators,
    loadCollaborators,
    inviteCollaborator,
    setCollaboratorRole,
    removeCollaborator,
    leaveSharedTrip,
    comments,
    addComment,
    toggleCommentResolved,
    deleteComment,
    dayLocks,
    aiLock,
    presence,
    heldDay,
    isCollaborativeTrip,
    acquireDayLock,
  } = useChat(userId)

  // null role = a brand-new trip the current user is creating (full access).
  const canEdit = tripRole == null || tripRole === 'owner' || tripRole === 'editor'
  const canManage = tripRole == null || tripRole === 'owner'
  const canComment = tripRole !== 'viewer'
  const aiLockedByOther = Boolean(aiLock && aiLock.userId !== userId)
  const chatDisabledNote = aiLockedByOther
    ? `${aiLock?.userName ?? 'Someone'} is updating with AI…`
    : !canEdit
      ? tripRole === 'commenter'
        ? 'Comment-only access — AI editing is off.'
        : 'View-only access — AI editing is off.'
      : null

  function handleManageCollaborators() {
    if (!savedTripId) return
    void loadCollaborators(savedTripId)
    setShowShareModal(true)
  }

  function handleSave() {
    if (!userId) {
      setShowGuestModal(true)
      return
    }
    void saveCurrentTrip()
  }

  function handleNewTrip() {
    startNewTrip()
    setPresentationMode('edit')
    setView('planner')
  }

  // Opening a saved plan lands on the read-only overview first; the user can
  // switch to edit mode from there.
  function handleOpenTrip(tripId: string) {
    setPresentationMode('overview')
    setView('planner')
    void openSavedTrip(tripId)
  }

  function handleBackToDashboard() {
    setView('dashboard')
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-[#f4efe7]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#dfd4c5] bg-[#fbf7ef] px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] sm:px-5 sm:py-3">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="group inline-flex items-center gap-2 text-sm font-semibold text-[#3e3021] transition hover:text-[#5f7d59]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#6f8a68] shadow-[0_0_0_4px_rgba(111,138,104,0.16)] transition group-hover:scale-110" />
            MeetU
          </button>
          <UserMenu name={userName} image={userImage} />
        </header>

        {view === 'dashboard' ? (
          <Dashboard
            savedTrips={savedTrips}
            isLoadingTrips={isLoadingTrips}
            onNewTrip={handleNewTrip}
            onOpenTrip={handleOpenTrip}
            onDeleteTrip={deleteSavedTrip}
            onLeaveTrip={leaveSharedTrip}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            {presentationMode === 'edit' && (
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                onSend={sendMessage}
                hasItinerary={Boolean(itinerary)}
                onBackToDashboard={handleBackToDashboard}
                chatDisabledNote={chatDisabledNote}
              />
            )}
            <CanvasPanel
              canvasState={canvasState}
              itinerary={itinerary}
              clarification={clarification}
              isLoading={isLoading}
              savedTripId={savedTripId}
              savedTripTitle={savedTripTitle}
              authorName={userName}
              savedTripIsPublished={savedTripIsPublished}
              savedTrips={savedTrips}
              isSaving={isSaving}
              isLoadingTrips={isLoadingTrips}
              saveStatus={saveStatus}
              saveError={saveError}
              presentationMode={presentationMode}
              role={tripRole ?? undefined}
              canManage={canManage}
              onManageCollaborators={canManage && savedTripId ? handleManageCollaborators : undefined}
              comments={comments}
              currentUserId={userId}
              canComment={canComment}
              onAddComment={canComment ? addComment : undefined}
              onToggleCommentResolved={toggleCommentResolved}
              onDeleteComment={deleteComment}
              dayLocks={dayLocks}
              aiLock={aiLock}
              presence={presence}
              heldDay={heldDay}
              lockingEnabled={isCollaborativeTrip}
              onActiveDayChange={acquireDayLock}
              onSetup={submitSetup}
              onSend={sendMessage}
              onUpdateItinerary={canEdit ? updateItinerary : undefined}
              onSave={handleSave}
              onOpenSavedTrip={handleOpenTrip}
              onRenameSavedTrip={canEdit ? renameSavedTripTitle : undefined}
              onPublishSavedTrip={canManage ? updateSavedTripPublishStatus : undefined}
              onPresentationModeChange={setPresentationMode}
              onBackToDashboard={handleBackToDashboard}
              onRetry={retry}
            />
          </div>
        )}
      </div>

      {showGuestModal && (
        <GuestSaveModal
          onClose={() => setShowGuestModal(false)}
          onSave={() => void saveCurrentTrip()}
        />
      )}

      {showShareModal && (
        <ShareModal
          title={savedTripTitle ?? itinerary?.trip.destination ?? 'This trip'}
          collaborators={collaborators}
          canManage={collaboratorsCanManage}
          isLoading={isLoadingCollaborators}
          currentUserId={userId}
          onInvite={inviteCollaborator}
          onSetRole={setCollaboratorRole}
          onRemove={removeCollaborator}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  )
}
