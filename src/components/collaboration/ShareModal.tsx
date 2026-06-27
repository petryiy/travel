'use client'

import { useState } from 'react'
import type { Collaborator, CollaboratorRole } from '@/types/travel'

interface Props {
  title: string
  collaborators: Collaborator[]
  canManage: boolean
  isLoading: boolean
  currentUserId: string | null
  onInvite: (email: string, role: CollaboratorRole) => Promise<{ ok: boolean; error?: string }>
  onSetRole: (userId: string, role: CollaboratorRole) => Promise<boolean>
  onRemove: (userId: string) => Promise<boolean>
  onClose: () => void
}

const ASSIGNABLE_ROLES: CollaboratorRole[] = ['editor', 'commenter', 'viewer']

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  owner: 'Owner',
  editor: 'Can edit',
  commenter: 'Can comment',
  viewer: 'Can view',
}

function initials(name: string | null, email: string | null) {
  const source = (name || email || '?').trim()
  return source.charAt(0).toUpperCase()
}

function sortOwnerFirst(a: Collaborator, b: Collaborator) {
  if (a.role === 'owner') return -1
  if (b.role === 'owner') return 1
  return 0
}

export function ShareModal({
  title,
  collaborators,
  canManage,
  isLoading,
  currentUserId,
  onInvite,
  onSetRole,
  onRemove,
  onClose,
}: Props) {
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor')
  const [isInviting, setIsInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  async function handleInvite() {
    const clean = email.trim()
    if (!clean) {
      setError('Enter the email of someone with an account.')
      return
    }
    setIsInviting(true)
    setError(null)
    setStatus(null)
    const result = await onInvite(clean, inviteRole)
    setIsInviting(false)
    if (result.ok) {
      setEmail('')
      setStatus('Shared. They will see it on their dashboard.')
    } else {
      setError(result.error ?? 'Unable to share with that email.')
    }
  }

  async function handleRoleChange(userId: string, role: CollaboratorRole) {
    setBusyUserId(userId)
    setError(null)
    setStatus(null)
    const ok = await onSetRole(userId, role)
    setBusyUserId(null)
    if (!ok) setError('Could not update that role.')
  }

  async function handleRemove(userId: string) {
    setBusyUserId(userId)
    setError(null)
    setStatus(null)
    const ok = await onRemove(userId)
    setBusyUserId(null)
    if (!ok) setError('Could not remove that person.')
  }

  const sorted = [...collaborators].sort(sortOwnerFirst)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2118]/45 px-3 py-5 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="w-full max-w-lg rounded-2xl border border-[#c7b58e] bg-[#fffaf0] p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b8a64]">Share with people</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#34271b]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#6d5740]">
              Invite anyone with a MeetU account. They will see this plan on their dashboard and can
              view, comment, or edit based on the access you give them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d2c1a3] bg-white px-3 py-1.5 text-sm font-bold text-[#6d5740] transition hover:bg-[#f7ead1]"
            aria-label="Close share dialog"
          >
            ×
          </button>
        </div>

        {canManage && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleInvite()
                }
              }}
              placeholder="name@example.com"
              className="flex-1 rounded-xl border border-[#d8c8a8] bg-white px-3 py-2.5 text-sm text-[#34271b] outline-none transition focus:border-[#70956c] focus:ring-2 focus:ring-[#dbe9d3]"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as CollaboratorRole)}
              className="rounded-xl border border-[#d8c8a8] bg-white px-3 py-2.5 text-sm font-semibold text-[#5e4932] outline-none transition focus:border-[#70956c]"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={isInviting}
              className="rounded-xl bg-[#5f7d59] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4f6b49] disabled:opacity-50"
            >
              {isInviting ? 'Sharing…' : 'Share'}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
        {status && <p className="mt-3 text-sm font-semibold text-[#5f7d59]">{status}</p>}

        <div className="mt-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a8a76]">
            People with access
          </p>
          {isLoading ? (
            <p className="py-3 text-sm text-[#9a8a76]">Loading…</p>
          ) : (
            <ul className="divide-y divide-[#ecdfca] rounded-xl border border-[#e6d8c0] bg-white">
              {sorted.map((person) => {
                const isOwner = person.role === 'owner'
                const isSelf = person.userId === currentUserId
                return (
                  <li key={person.userId} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e3efe2] text-sm font-bold text-[#496248]">
                      {initials(person.name, person.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#34271b]">
                        {person.name || person.email || 'Unknown'}
                        {isSelf && <span className="ml-1 text-[#9a8a76]">(you)</span>}
                      </p>
                      {person.email && person.name && (
                        <p className="truncate text-xs text-[#9a8a76]">{person.email}</p>
                      )}
                    </div>

                    {isOwner || !canManage ? (
                      <span className="shrink-0 rounded-full bg-[#efe7d8] px-3 py-1 text-xs font-bold text-[#7d6c58]">
                        {ROLE_LABELS[person.role]}
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <select
                          value={person.role}
                          disabled={busyUserId === person.userId}
                          onChange={(event) =>
                            void handleRoleChange(person.userId, event.target.value as CollaboratorRole)
                          }
                          className="rounded-lg border border-[#d8c8a8] bg-white px-2 py-1.5 text-xs font-semibold text-[#5e4932] outline-none transition focus:border-[#70956c] disabled:opacity-50"
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleRemove(person.userId)}
                          disabled={busyUserId === person.userId}
                          className="rounded-lg px-2 py-1.5 text-xs font-bold text-[#a0927f] transition hover:bg-[#f7ead1] hover:text-[#b4493a] disabled:opacity-50"
                          aria-label={`Remove ${person.name || person.email || 'collaborator'}`}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#c7b58e] bg-white px-5 py-2 text-sm font-semibold text-[#6d5740] transition hover:bg-[#f7ead1]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
