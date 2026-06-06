'use client'

import { useMemo, useState } from 'react'
import type { Activity, DayPlan, Itinerary } from '@/types/travel'
import { getDayLocations, getLocationCenter } from '@/lib/itineraryMap'
import { downloadItineraryPdf } from '@/lib/itineraryPdf'
import { createItineraryPosterDataUrl } from '@/lib/posterExport'
import { MapView } from './MapView'
import { PosterExportModal } from './PosterExportModal'

const TYPE_STYLES: Record<Activity['type'], string> = {
  food: 'bg-[#f8dfad] text-[#765320]',
  attraction: 'bg-[#cfe6ef] text-[#315d69]',
  transport: 'bg-[#e5ded0] text-[#64523d]',
  accommodation: 'bg-[#cfe5d6] text-[#356247]',
  activity: 'bg-[#d9e8bf] text-[#526931]',
}

const DAY_ROTATIONS = ['rotate-[-0.35deg]', 'rotate-[0.25deg]', 'rotate-[-0.2deg]', 'rotate-[0.3deg]']

const TIME_LABELS: Record<Activity['time'], string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

interface Props {
  itinerary: Itinerary
  savedTripTitle: string | null
  savedTripId?: string | null
  authorName?: string | null
  isPublished?: boolean
  isPublicView?: boolean
  onBackToDashboard?: () => void
  onEdit?: () => void
  onRenameTitle?: (title: string) => Promise<boolean>
  onPublishChange?: (isPublished: boolean) => Promise<boolean>
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatDateRange(startDate: string, endDate: string) {
  return startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`
}

function formatTimeRange(activity: Activity) {
  if (activity.startTime && activity.endTime) return `${activity.startTime} - ${activity.endTime}`
  if (activity.startTime) return activity.startTime
  return TIME_LABELS[activity.time]
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function dayWindow(day: DayPlan, itinerary: Itinerary) {
  const start = day.startTime ?? itinerary.trip.dailyStartTime
  const end = day.endTime ?? itinerary.trip.dailyEndTime

  if (start && end) return `${start} - ${end}`
  if (start) return `from ${start}`
  if (end) return `until ${end}`
  return null
}

function getTripLocations(itinerary: Itinerary) {
  const dayLocations = itinerary.days.flatMap((day) => getDayLocations(day))
  return dayLocations.length > 0 ? dayLocations : itinerary.keyLocations
}

function fallbackPosterCaption(itinerary: Itinerary) {
  return `A softer way to meet ${itinerary.trip.destination}, one gentle moment at a time.`
}

function displayAuthorName(value?: string | null) {
  const name = value?.trim()
  return name || 'MeetU traveler'
}

export function ItineraryOverview({
  itinerary,
  savedTripTitle,
  savedTripId,
  authorName,
  isPublished = false,
  isPublicView = false,
  onBackToDashboard,
  onEdit,
  onRenameTitle,
  onPublishChange,
}: Props) {
  const title = savedTripTitle ?? itinerary.trip.destination
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [isPosterOpen, setIsPosterOpen] = useState(false)
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null)
  const [posterError, setPosterError] = useState<string | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<string | null>(null)
  const shownAuthorName = displayAuthorName(authorName)
  const mapLocations = useMemo(() => getTripLocations(itinerary), [itinerary])
  const mapCenter = getLocationCenter(mapLocations, itinerary.mapCenter)
  const activityCount = itinerary.days.reduce((total, day) => total + day.activities.length, 0)
  const travelMinutes = itinerary.days.reduce(
    (total, day) =>
      total +
      day.activities.reduce((dayTotal, activity) => dayTotal + (activity.travelFromPrevious?.durationMinutes ?? 0), 0),
    0
  )
  const firstDay = itinerary.days[0]
  const finalDay = itinerary.days[itinerary.days.length - 1]

  async function handleSaveTitle() {
    if (!onRenameTitle) return

    const cleanTitle = draftTitle.trim()
    if (!cleanTitle) {
      setTitleError('Please enter a title.')
      return
    }

    if (cleanTitle.length > 120) {
      setTitleError('Keep the title under 120 characters.')
      return
    }

    if (cleanTitle === title) {
      setIsEditingTitle(false)
      setTitleError(null)
      return
    }

    setIsSavingTitle(true)
    setTitleError(null)
    const renamed = await onRenameTitle(cleanTitle)
    setIsSavingTitle(false)

    if (renamed) {
      setIsEditingTitle(false)
    } else {
      setTitleError('Could not save the new title.')
    }
  }

  function handleCancelTitle() {
    setDraftTitle(title)
    setTitleError(null)
    setIsEditingTitle(false)
  }

  async function handleOpenPoster() {
    setPosterDataUrl(null)
    setPosterError(null)
    setIsPosterOpen(true)

    try {
      const caption = itinerary.posterCaption ?? fallbackPosterCaption(itinerary)
      setPosterDataUrl(await createItineraryPosterDataUrl(itinerary, { title, caption }))
      setPosterError(null)
    } catch {
      setPosterDataUrl(null)
      setPosterError('Could not create the poster preview.')
    }
  }

  function handleExportPdf() {
    downloadItineraryPdf(itinerary, { title, authorName: shownAuthorName })
  }

  function handleOpenShare() {
    if (!savedTripId) {
      setShareUrl(null)
      setShareStatus('Save this trip before sharing.')
      setIsShareOpen(true)
      return
    }

    const url = `${window.location.origin}/share/${savedTripId}`
    setShareUrl(url)
    setShareStatus(null)
    setIsShareOpen(true)
  }

  async function handleCopyShareLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareStatus('Link copied.')
    } catch {
      setShareStatus('Could not copy automatically. You can copy it manually.')
    }
  }

  function handleOpenPublish() {
    if (!savedTripId) {
      setPublishStatus('Save this trip before publishing.')
      setIsPublishOpen(true)
      return
    }

    setPublishStatus(null)
    setIsPublishOpen(true)
  }

  async function handleConfirmPublishChange() {
    if (!onPublishChange || !savedTripId) return

    setIsPublishing(true)
    setPublishStatus(null)
    const updated = await onPublishChange(!isPublished)
    setIsPublishing(false)

    if (updated) {
      setPublishStatus(!isPublished ? 'Published to Gallery.' : 'Removed from Gallery.')
      setIsPublishOpen(false)
    } else {
      setPublishStatus('Could not update Gallery publishing.')
    }
  }

  return (
    <main className="journal-desk flex-1 overflow-y-auto text-[#3e3021]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {onBackToDashboard ? (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="journal-sketch rounded-lg bg-[#fffaf0]/90 px-4 py-2 text-sm font-semibold text-[#5c4630] shadow-sm transition hover:bg-white"
            >
              Dashboard
            </button>
          ) : (
            <span className="journal-sketch rounded-lg bg-[#fffaf0]/90 px-4 py-2 text-sm font-semibold text-[#5c4630] shadow-sm">
              MeetU shared plan
            </span>
          )}

          {!isPublicView && onEdit ? (
            <div className="journal-sketch flex rounded-lg bg-[#fffaf0]/88 p-1 shadow-sm">
              <span className="rounded-md bg-[#3f3428] px-4 py-2 text-sm font-semibold text-[#fff7e7]">
                Overview
              </span>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-md px-4 py-2 text-sm font-semibold text-[#806a52] transition hover:bg-[#f6ead3] hover:text-[#3e3021]"
              >
                Edit with agent
              </button>
            </div>
          ) : (
            <span className="journal-sketch rounded-lg bg-[#d8e7d2] px-4 py-2 text-sm font-semibold text-[#426145] shadow-sm">
              Shared overview
            </span>
          )}
        </div>

        <section className="journal-paper journal-sketch rotate-[-0.12deg] rounded-lg px-5 py-7 sm:px-8 lg:px-10">
          <span className="journal-tape absolute left-10 top-0 h-7 w-32 -translate-y-1/2 rotate-[-4deg] rounded-sm opacity-90" />
          <span className="journal-tape absolute right-16 top-0 h-7 w-28 -translate-y-1/2 rotate-[5deg] rounded-sm opacity-75" />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.32fr)_minmax(300px,0.68fr)] lg:items-end">
            <div>
              <p className="inline-flex rotate-[-1deg] rounded-md bg-[#d8e7d2] px-3 py-1.5 text-xs font-bold uppercase text-[#426145]">
                Saved itinerary
              </p>
              {(isPublicView || isPublished) && (
                <p className="mt-3 inline-flex max-w-full flex-wrap rounded-full border border-[#d8c8a8] bg-[#fffdf5]/80 px-3 py-1.5 text-sm font-semibold text-[#6f8a68]">
                  Created by {shownAuthorName}
                </p>
              )}
              {isEditingTitle ? (
                <div className="mt-4 max-w-3xl">
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleSaveTitle()
                      }

                      if (event.key === 'Escape') {
                        handleCancelTitle()
                      }
                    }}
                    autoFocus
                    maxLength={120}
                    className="journal-sketch w-full rounded-lg bg-[#fffdf5]/90 px-4 py-3 font-serif text-3xl font-bold leading-tight text-[#34271b] outline-none transition focus:border-[#70956c] focus:ring-4 focus:ring-[#dbe9d3] lg:text-5xl"
                    aria-label="Trip title"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveTitle()}
                      disabled={isSavingTitle}
                      className="rounded-full bg-[#3f3428] px-4 py-2 text-sm font-semibold text-[#fff7e7] transition hover:bg-[#5a4938] disabled:opacity-50"
                    >
                      {isSavingTitle ? 'Saving...' : 'Save title'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelTitle}
                      disabled={isSavingTitle}
                      className="journal-sketch rounded-full bg-[#fffaf0]/80 px-4 py-2 text-sm font-semibold text-[#6d5740] transition hover:bg-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    {titleError && <span className="text-sm font-medium text-rose-700">{titleError}</span>}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex max-w-4xl flex-wrap items-end gap-3">
                  <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight text-[#34271b] lg:text-6xl">
                    {title}
                  </h1>
                  {!isPublicView && (
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {onRenameTitle && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftTitle(title)
                            setTitleError(null)
                            setIsEditingTitle(true)
                          }}
                          className="journal-sketch rotate-[1deg] rounded-lg bg-[#fff7d7] px-3 py-1.5 text-sm font-semibold text-[#6c4f2b] shadow-sm transition hover:bg-[#ffefba]"
                        >
                          Rename
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleOpenShare}
                        className="journal-sketch rounded-lg bg-[#d8e7d2] px-3 py-1.5 text-sm font-semibold text-[#426145] shadow-sm transition hover:bg-[#cbe1c2]"
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPublish}
                        className="journal-sketch rounded-lg bg-[#fffaf0] px-3 py-1.5 text-sm font-semibold text-[#5e4932] shadow-sm transition hover:bg-white"
                      >
                        {isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {title !== itinerary.trip.destination && (
                <p className="mt-3 text-sm font-semibold text-[#776149]">
                  {itinerary.trip.destination}
                </p>
              )}
              <p className="journal-note-lines mt-5 max-w-3xl border-l-2 border-[#b9a583] pl-4 text-base leading-8 text-[#5f4c36]">
                {itinerary.summary}
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <span className="journal-sketch rotate-[-1deg] rounded-md bg-[#f7ddb7] px-4 py-2 text-sm font-semibold text-[#694c28]">
                  {formatDateRange(itinerary.trip.startDate, itinerary.trip.endDate)}
                </span>
                <span className="journal-sketch rotate-[0.8deg] rounded-md bg-[#dbe9d3] px-4 py-2 text-sm font-semibold text-[#496248]">
                  {itinerary.days.length} {itinerary.days.length === 1 ? 'day' : 'days'}
                </span>
                <span className="journal-sketch rotate-[-0.5deg] rounded-md bg-[#dce9ef] px-4 py-2 text-sm font-semibold text-[#3f6070]">
                  {itinerary.trip.travelers} {itinerary.trip.travelers === 1 ? 'traveler' : 'travelers'}
                </span>
                {itinerary.trip.accommodationLocation && (
                  <span className="journal-sketch rotate-[0.5deg] rounded-md bg-[#efe3cf] px-4 py-2 text-sm font-semibold text-[#675038]">
                    Stay near {itinerary.trip.accommodationLocation}
                  </span>
                )}
              </div>
            </div>

            <div className="journal-sketch relative rotate-[0.6deg] rounded-lg bg-[#fff7dc]/82 p-5">
              <span className="journal-tape absolute left-1/2 top-0 h-5 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[2deg] rounded-sm opacity-80" />
              <p className="font-serif text-xl font-bold text-[#3b2d20]">Trip rhythm</p>
              <dl className="mt-4 divide-y divide-dashed divide-[#bca986]">
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-sm font-semibold text-[#76624a]">Planned stops</dt>
                  <dd className="font-serif text-2xl font-bold text-[#34271b]">{activityCount}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-sm font-semibold text-[#76624a]">Travel time</dt>
                  <dd className="font-serif text-2xl font-bold text-[#34271b]">{formatMinutes(travelMinutes)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-sm font-semibold text-[#76624a]">First day</dt>
                  <dd className="text-right text-sm font-bold text-[#34271b]">{firstDay ? formatDate(firstDay.date) : '-'}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-sm font-semibold text-[#76624a]">Last day</dt>
                  <dd className="text-right text-sm font-bold text-[#34271b]">{finalDay ? formatDate(finalDay.date) : '-'}</dd>
                </div>
              </dl>
              <div>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="journal-sketch mt-4 w-full rounded-lg bg-[#fff7d7] px-4 py-3 text-sm font-semibold text-[#6c4f2b] transition hover:bg-[#ffefba]"
                >
                  Export PDF
                </button>
                {!isPublicView && (
                  <>
                  <button
                    type="button"
                    onClick={() => void handleOpenPoster()}
                    className="journal-sketch mt-3 w-full rounded-lg bg-[#3f3428] px-4 py-3 text-sm font-semibold text-[#fff7e7] transition hover:bg-[#5a4938]"
                  >
                    Export poster
                  </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.34fr)_minmax(320px,0.66fr)]">
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 px-1">
              <div>
                <p className="text-xs font-bold uppercase text-[#517052]">Daily flow</p>
                <h2 className="mt-1 font-serif text-3xl font-bold text-[#34271b]">Days at a glance</h2>
              </div>
            </div>

            <div className="space-y-5">
              {itinerary.days.map((day, dayIndex) => {
                const window = dayWindow(day, itinerary)
                return (
                  <article
                    key={`${day.day}-${day.date}`}
                    className={`journal-paper journal-sketch rounded-lg p-5 sm:p-6 ${DAY_ROTATIONS[dayIndex % DAY_ROTATIONS.length]}`}
                  >
                    <span className="journal-tape absolute left-8 top-0 h-5 w-24 -translate-y-1/2 rotate-[-3deg] rounded-sm opacity-75" />
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="journal-sketch inline-flex rotate-[-1deg] rounded-md bg-[#dce9ef] px-3 py-1.5 text-xs font-bold text-[#41606f]">
                          Day {day.day}
                        </p>
                        <h3 className="mt-3 font-serif text-2xl font-bold text-[#34271b]">{day.theme}</h3>
                        <p className="mt-1 text-sm font-semibold text-[#78634c]">
                          {formatDate(day.date)}
                          {window ? ` - ${window}` : ''}
                        </p>
                      </div>
                      <span className="journal-sketch rounded-md bg-[#f7ddb7] px-3 py-1.5 text-xs font-bold text-[#694c28]">
                        {day.activities.length} stops
                      </span>
                    </div>

                    <div className="journal-note-lines mt-5 divide-y divide-dashed divide-[#c7b58e]">
                      {day.activities.map((activity, index) => (
                        <div key={`${activity.title}-${index}`} className="grid gap-3 py-4 md:grid-cols-[116px_minmax(0,1fr)]">
                          <div className="flex items-start gap-2 md:block">
                            <span className="journal-sketch inline-flex rounded-md bg-[#fff7d7] px-2.5 py-1 text-xs font-bold text-[#6c4f2b]">
                              {formatTimeRange(activity)}
                            </span>
                            <span className={`mt-0 inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold capitalize md:mt-2 ${TYPE_STYLES[activity.type]}`}>
                              {activity.type}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#34271b]">{activity.title}</p>
                            <p className="mt-1 truncate text-xs font-semibold text-[#7b6650]">{activity.location}</p>
                            <p className="mt-2 text-xs leading-5 text-[#5f4c36]">{activity.description}</p>
                            {activity.travelFromPrevious && (
                              <p className="mt-2 text-xs font-semibold text-[#8a6f50]">
                                {activity.travelFromPrevious.durationMinutes} min {activity.travelFromPrevious.mode}: {activity.travelFromPrevious.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <div className="journal-paper journal-sketch relative h-[430px] rounded-lg p-4">
              <span className="journal-tape absolute left-8 top-0 h-5 w-24 -translate-y-1/2 rotate-[-5deg] rounded-sm opacity-80" />
              <div className="h-full overflow-hidden rounded-md border border-[#c7b58e] bg-[#f8f1df]">
                <MapView center={mapCenter} locations={mapLocations} />
              </div>
            </div>

            {itinerary.tips.length > 0 && (
              <div className="journal-paper journal-sketch journal-note-lines relative rounded-lg p-5">
                <span className="journal-tape absolute right-8 top-0 h-5 w-24 -translate-y-1/2 rotate-[4deg] rounded-sm opacity-75" />
                <p className="font-serif text-xl font-bold text-[#34271b]">Notes</p>
                <ul className="mt-4 space-y-3">
                  {itinerary.tips.map((tip, index) => (
                    <li key={`${tip}-${index}`} className="flex gap-3 text-sm leading-6 text-[#5f4c36]">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6b8a64]" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>
      </div>
      <PosterExportModal
        title={title}
        dataUrl={posterDataUrl}
        error={posterError}
        open={isPosterOpen}
        onClose={() => setIsPosterOpen(false)}
      />
      {isShareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2118]/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#c7b58e] bg-[#fffaf0] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b8a64]">Share plan</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-[#34271b]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6d5740]">
                  Anyone with this link can view the overview page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShareOpen(false)}
                className="rounded-full border border-[#d2c1a3] bg-white px-3 py-1.5 text-sm font-bold text-[#6d5740] transition hover:bg-[#f7ead1]"
                aria-label="Close share dialog"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[#d8c8a8] bg-white p-3">
              {shareUrl ? (
                <p className="break-all text-sm leading-6 text-[#5f4c36]">{shareUrl}</p>
              ) : (
                <p className="text-sm font-semibold text-[#8a5a3b]">{shareStatus}</p>
              )}
            </div>

            {shareStatus && shareUrl && (
              <p className="mt-3 text-sm font-semibold text-[#5f7d59]">{shareStatus}</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsShareOpen(false)}
                className="rounded-full border border-[#c7b58e] bg-white px-4 py-2 text-sm font-semibold text-[#6d5740] transition hover:bg-[#f7ead1]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleCopyShareLink()}
                disabled={!shareUrl}
                className="rounded-full bg-[#3f3428] px-4 py-2 text-sm font-semibold text-[#fff7e7] transition hover:bg-[#5a4938] disabled:opacity-50"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      )}
      {isPublishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2118]/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#c7b58e] bg-[#fffaf0] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b8a64]">Gallery</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-[#34271b]">
                  {isPublished ? 'Unpublish this plan?' : 'Publish this plan?'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6d5740]">
                  {isPublished
                    ? 'This trip will be removed from the public Gallery. Existing private share links will still work.'
                    : `This trip will appear in the public Gallery as created by ${shownAuthorName}, and anyone can open its overview page.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublishOpen(false)}
                className="rounded-full border border-[#d2c1a3] bg-white px-3 py-1.5 text-sm font-bold text-[#6d5740] transition hover:bg-[#f7ead1]"
                aria-label="Close publish dialog"
              >
                ×
              </button>
            </div>

            {!isPublished && (
              <div className="mt-5 rounded-xl border border-[#d8c8a8] bg-white p-3 text-sm leading-6 text-[#6d5740]">
                Make sure you are comfortable showing details such as accommodation area, fixed bookings, and daily plans.
              </div>
            )}

            {publishStatus && (
              <p className="mt-3 text-sm font-semibold text-[#8a5a3b]">{publishStatus}</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPublishOpen(false)}
                className="rounded-full border border-[#c7b58e] bg-white px-4 py-2 text-sm font-semibold text-[#6d5740] transition hover:bg-[#f7ead1]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPublishChange()}
                disabled={isPublishing || !savedTripId}
                className="rounded-full bg-[#3f3428] px-4 py-2 text-sm font-semibold text-[#fff7e7] transition hover:bg-[#5a4938] disabled:opacity-50"
              >
                {isPublishing ? 'Updating...' : isPublished ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
