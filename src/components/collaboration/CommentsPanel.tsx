'use client'

import { useMemo, useState } from 'react'
import type { TripComment } from '@/types/travel'

type Scope = 'day' | 'trip'

interface Props {
  savedTripId: string | null
  dayNumber: number | null
  comments: TripComment[]
  currentUserId: string | null
  canComment: boolean
  canManage: boolean
  onAdd: (body: string, scope: Scope) => Promise<boolean>
  onToggleResolved: (commentId: string, resolved: boolean) => Promise<boolean>
  onDelete: (commentId: string) => Promise<boolean>
}

function initial(name: string | null) {
  return (name || '?').trim().charAt(0).toUpperCase()
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function CommentsPanel({
  savedTripId,
  dayNumber,
  comments,
  currentUserId,
  canComment,
  canManage,
  onAdd,
  onToggleResolved,
  onDelete,
}: Props) {
  const [scope, setScope] = useState<Scope>(dayNumber ? 'day' : 'trip')
  const [draft, setDraft] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const list =
      scope === 'day'
        ? comments.filter((c) => c.anchorType === 'day' && c.anchorDay === dayNumber)
        : comments.filter((c) => c.anchorType === 'trip')
    return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [comments, scope, dayNumber])

  async function handlePost() {
    const clean = draft.trim()
    if (!clean) return
    setIsPosting(true)
    const ok = await onAdd(clean, scope)
    setIsPosting(false)
    if (ok) setDraft('')
  }

  async function handleToggle(comment: TripComment) {
    setBusyId(comment.id)
    await onToggleResolved(comment.id, !comment.resolved)
    setBusyId(null)
  }

  async function handleDelete(commentId: string) {
    setBusyId(commentId)
    await onDelete(commentId)
    setBusyId(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-1 pb-2">
        <button
          type="button"
          onClick={() => setScope('day')}
          disabled={!dayNumber}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
            scope === 'day' ? 'bg-[#5f7d59] text-white' : 'bg-[#f0e8da] text-[#75624c] hover:bg-[#e8ddca]'
          }`}
        >
          {dayNumber ? `Day ${dayNumber}` : 'This day'}
        </button>
        <button
          type="button"
          onClick={() => setScope('trip')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            scope === 'trip' ? 'bg-[#5f7d59] text-white' : 'bg-[#f0e8da] text-[#75624c] hover:bg-[#e8ddca]'
          }`}
        >
          Whole trip
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
        {!savedTripId ? (
          <p className="px-2 py-6 text-center text-sm text-[#9a8a76]">
            Save this trip to start a conversation with collaborators.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[#9a8a76]">
            No comments {scope === 'day' ? 'on this day' : 'for the whole trip'} yet.
          </p>
        ) : (
          visible.map((comment) => {
            const mine = comment.userId === currentUserId
            const canTouch = mine || canManage
            return (
              <div
                key={comment.id}
                className={`rounded-xl border px-3 py-2.5 transition ${
                  comment.resolved
                    ? 'border-[#e0d7cb] bg-[#f4efe6] opacity-70'
                    : 'border-[#e6d8c0] bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3efe2] text-xs font-bold text-[#496248]">
                    {initial(comment.authorName)}
                  </span>
                  <span className="truncate text-xs font-bold text-[#34271b]">
                    {comment.authorName || 'Someone'}
                    {mine && <span className="ml-1 font-medium text-[#9a8a76]">(you)</span>}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-[#a0927f]">{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-[#4d3f2e]">
                  {comment.body}
                </p>
                {(canTouch || comment.resolved) && (
                  <div className="mt-2 flex items-center gap-3">
                    {canTouch && (
                      <button
                        type="button"
                        onClick={() => void handleToggle(comment)}
                        disabled={busyId === comment.id}
                        className="text-[11px] font-bold text-[#5f7d59] transition hover:text-[#42603d] disabled:opacity-50"
                      >
                        {comment.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                    )}
                    {comment.resolved && !canTouch && (
                      <span className="text-[11px] font-bold text-[#9a8a76]">Resolved</span>
                    )}
                    {canTouch && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(comment.id)}
                        disabled={busyId === comment.id}
                        className="text-[11px] font-bold text-[#a0927f] transition hover:text-[#b4493a] disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {savedTripId && canComment && (
        <div className="shrink-0 border-t border-[#e8ddd0] px-1 pt-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void handlePost()
              }
            }}
            rows={2}
            placeholder={scope === 'day' ? `Comment on Day ${dayNumber ?? ''}…` : 'Comment on the whole trip…'}
            className="w-full resize-none rounded-xl border border-[#d8c8a8] bg-white px-3 py-2 text-sm text-[#34271b] outline-none transition focus:border-[#70956c] focus:ring-2 focus:ring-[#dbe9d3]"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] text-[#a0927f]">⌘/Ctrl + Enter</span>
            <button
              type="button"
              onClick={() => void handlePost()}
              disabled={isPosting || !draft.trim()}
              className="rounded-full bg-[#5f7d59] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4f6b49] disabled:opacity-50"
            >
              {isPosting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
