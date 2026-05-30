'use client'

import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'

export default function Home() {
  const { messages, canvasState, itinerary, clarification, isLoading, submitSetup, sendMessage } = useChat()

  return (
    <div className="flex h-full overflow-hidden">
      <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} />
      <CanvasPanel
        canvasState={canvasState}
        itinerary={itinerary}
        clarification={clarification}
        isLoading={isLoading}
        onSetup={submitSetup}
        onSend={sendMessage}
      />
    </div>
  )
}
