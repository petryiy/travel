'use client'

import { useChat } from '@/hooks/useChat'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CanvasPanel } from '@/components/canvas/CanvasPanel'
import { ParticleField } from '@/components/canvas/ParticleField'

export default function Home() {
  const { messages, canvasState, itinerary, locationFocus, clarification, isLoading, storageState, sendMessage } = useChat()

  return (
    <div className="relative flex h-full overflow-hidden bg-slate-950 text-cyan-50">
      <ParticleField />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(90deg,rgba(0,255,209,0.04)_1px,transparent_1px),linear-gradient(rgba(0,255,209,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_70%_10%,rgba(125,58,255,0.24),transparent_34%),radial-gradient(circle_at_24%_70%,rgba(0,255,209,0.13),transparent_36%)]" />
      <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} />
      <CanvasPanel
        canvasState={canvasState}
        itinerary={itinerary}
        locationFocus={locationFocus}
        clarification={clarification}
        isLoading={isLoading}
        storageState={storageState}
        onSend={sendMessage}
      />
    </div>
  )
}
