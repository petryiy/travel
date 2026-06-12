'use client'

/* eslint-disable react-hooks/static-components */

import { Fragment, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Activity, DayPlan, Itinerary, TravelOption } from '@/types/travel'
import { getDayLocations, getLocationCenter } from '@/lib/itineraryMap'
import { MapView } from './MapView'

const TYPE_COLORS: Record<Activity['type'], string> = {
  food: 'bg-[#f8dfad] text-[#765320] border-[#e9c98f]',
  attraction: 'bg-[#cfe6ef] text-[#315d69] border-[#accbd6]',
  transport: 'bg-[#e7dfd2] text-[#64523d] border-[#d3c5b0]',
  accommodation: 'bg-[#cfe5d6] text-[#356247] border-[#aac8b3]',
  activity: 'bg-[#d9e8bf] text-[#526931] border-[#bbd39a]',
}

const ACTIVITY_TYPES: Activity['type'][] = ['food', 'attraction', 'transport', 'accommodation', 'activity']

function dayWindow(dayStart?: string, dayEnd?: string) {
  if (dayStart && dayEnd) return `${dayStart}–${dayEnd}`
  if (dayStart) return `from ${dayStart}`
  if (dayEnd) return `until ${dayEnd}`
  return null
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function parseClockTime(value?: string) {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function formatClockTime(totalMinutes: number) {
  const minutesInDay = 24 * 60
  const normalized = ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function shiftClockTime(value: string | undefined, deltaMinutes: number) {
  const minutes = parseClockTime(value)
  if (minutes == null) return value
  return formatClockTime(minutes + deltaMinutes)
}

function diffClockMinutes(start?: string, end?: string) {
  const startMinutes = parseClockTime(start)
  const endMinutes = parseClockTime(end)
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return null
  return endMinutes - startMinutes
}

function endTimeFromDuration(start?: string, durationMinutes?: number) {
  const startMinutes = parseClockTime(start)
  if (startMinutes == null || !durationMinutes || durationMinutes <= 0) return null
  return formatClockTime(startMinutes + durationMinutes)
}

function buildTimePatch(activity: Activity, field: string, value: string): Partial<Activity> {
  if (field === 'startTime') {
    const patch: Partial<Activity> = { startTime: value || undefined }
    if (!value) return patch

    const syncedEnd = endTimeFromDuration(value, activity.durationMinutes)
    if (syncedEnd) patch.endTime = syncedEnd
    else {
      const syncedDuration = diffClockMinutes(value, activity.endTime)
      if (syncedDuration != null) patch.durationMinutes = syncedDuration
    }
    return patch
  }

  if (field === 'endTime') {
    const patch: Partial<Activity> = { endTime: value || undefined }
    const syncedDuration = diffClockMinutes(activity.startTime, value)
    if (syncedDuration != null) patch.durationMinutes = syncedDuration
    return patch
  }

  if (field === 'dur') {
    const durationMinutes = Number(value)
    const patch: Partial<Activity> = {
      durationMinutes: value && Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : undefined,
    }
    const syncedEnd = endTimeFromDuration(activity.startTime, patch.durationMinutes)
    if (syncedEnd) patch.endTime = syncedEnd
    return patch
  }

  return {}
}

function shiftActivityTimes(activity: Activity, deltaMinutes: number): Activity {
  if (deltaMinutes === 0) return activity
  return {
    ...activity,
    startTime: shiftClockTime(activity.startTime, deltaMinutes),
    endTime: shiftClockTime(activity.endTime, deltaMinutes),
  }
}

const MODE_LABELS: Record<TravelOption['mode'], string> = {
  walk: 'Walk',
  transit: 'Transit',
  taxi: 'Taxi',
  rideshare: 'Rideshare',
  train: 'Train',
  bus: 'Bus',
  ferry: 'Ferry',
  flight: 'Flight',
  other: 'Route',
}

const MODE_BADGES: Record<TravelOption['mode'], string> = {
  walk: 'W',
  transit: 'PT',
  taxi: 'TX',
  rideshare: 'RS',
  train: 'TR',
  bus: 'BU',
  ferry: 'FY',
  flight: 'FL',
  other: 'GO',
}

function travelOptionsForActivity(activity: Activity): TravelOption[] {
  const options = Array.isArray(activity.travelOptions)
    ? activity.travelOptions.filter((option) => option && option.durationMinutes != null && option.description)
    : []

  if (options.length > 0) return options.slice(0, 3)
  return activity.travelFromPrevious ? [{ ...activity.travelFromPrevious, recommended: true }] : []
}

function hoursSourceLabel(source?: Activity['hoursSource']) {
  if (source === 'google') return 'Google Places'
  if (source === 'osm') return 'OpenStreetMap'
  if (source === 'gemini') return 'MeetU estimate'
  return 'Not verified yet'
}

function travelGapStatus(previous: Activity | undefined, current: Activity | null, travelMinutes?: number) {
  if (!previous || !current || !travelMinutes) return null
  const previousEnd = parseClockTime(previous.endTime)
  const currentStart = parseClockTime(current.startTime)
  if (previousEnd == null || currentStart == null) return null

  const available = currentStart - previousEnd
  if (available < travelMinutes) {
    return {
      type: 'conflict' as const,
      available,
      needed: travelMinutes,
      shortBy: travelMinutes - available,
    }
  }

  return {
    type: 'ok' as const,
    available,
    needed: travelMinutes,
    buffer: available - travelMinutes,
  }
}

function travelWindow(previous: Activity, durationMinutes: number) {
  const start = parseClockTime(previous.endTime)
  if (start == null) return null
  return {
    start: previous.endTime,
    end: formatClockTime(start + durationMinutes),
  }
}

// ── Immutable update helpers ──────────────────────────────────────────────────

function patchActivity(it: Itinerary, dayIdx: number, actIdx: number, patch: Partial<Activity>): Itinerary {
  return {
    ...it,
    days: it.days.map((d, di) =>
      di !== dayIdx ? d : {
        ...d,
        activities: d.activities.map((a, ai) => ai !== actIdx ? a : { ...a, ...patch }),
      }
    ),
  }
}

function patchActivityAndShiftFollowing(it: Itinerary, dayIdx: number, actIdx: number, patch: Partial<Activity>): Itinerary {
  const originalActivity = it.days[dayIdx]?.activities[actIdx]
  if (!originalActivity) return it

  const updatedActivity = { ...originalActivity, ...patch }
  const oldEnd = parseClockTime(originalActivity.endTime)
  const newEnd = parseClockTime(updatedActivity.endTime)
  const deltaMinutes = oldEnd != null && newEnd != null ? newEnd - oldEnd : 0
  let shouldShift = deltaMinutes !== 0

  return {
    ...it,
    days: it.days.map((d, di) => {
      if (di !== dayIdx) return d

      return {
        ...d,
        activities: d.activities.map((activity, ai) => {
          if (ai === actIdx) return updatedActivity
          if (ai <= actIdx || !shouldShift) return activity
          if (activity.isFixedTime) {
            shouldShift = false
            return activity
          }
          return shiftActivityTimes(activity, deltaMinutes)
        }),
      }
    }),
  }
}

function rescheduleActivitiesFromIndex(activities: Activity[], startIdx: number): Activity[] {
  let timelineCursor: number | null = null

  return activities.map((activity, idx) => {
    if (idx < startIdx) {
      timelineCursor = parseClockTime(activity.endTime) ?? timelineCursor
      return activity
    }

    if (idx === 0 || activity.isFixedTime) {
      timelineCursor = parseClockTime(activity.endTime) ?? timelineCursor
      return activity
    }

    const travelMinutes = travelOptionsForActivity(activity)[0]?.durationMinutes ?? 0
    const originalStart = parseClockTime(activity.startTime)
    const originalEnd = parseClockTime(activity.endTime)
    const durationMinutes = activity.durationMinutes ?? diffClockMinutes(activity.startTime, activity.endTime)

    if (timelineCursor == null || durationMinutes == null || durationMinutes <= 0) {
      timelineCursor = originalEnd ?? timelineCursor
      return activity
    }

    const nextStart = timelineCursor + travelMinutes
    const nextEnd = nextStart + durationMinutes
    timelineCursor = nextEnd

    if (originalStart === nextStart && originalEnd === nextEnd) return activity
    return {
      ...activity,
      startTime: formatClockTime(nextStart),
      endTime: formatClockTime(nextEnd),
    }
  })
}

function reorderActivitiesAndReschedule(it: Itinerary, dayIdx: number, oldIdx: number, newIdx: number): Itinerary {
  return {
    ...it,
    days: it.days.map((d, di) => {
      if (di !== dayIdx) return d
      const reordered = arrayMove(d.activities, oldIdx, newIdx)
      return {
        ...d,
        activities: rescheduleActivitiesFromIndex(reordered, Math.min(oldIdx, newIdx)),
      }
    }),
  }
}

function patchDay(it: Itinerary, dayIdx: number, patch: Partial<DayPlan>): Itinerary {
  return { ...it, days: it.days.map((d, di) => di !== dayIdx ? d : { ...d, ...patch }) }
}

function removeActivity(it: Itinerary, dayIdx: number, actIdx: number): Itinerary {
  return {
    ...it,
    days: it.days.map((d, di) =>
      di !== dayIdx ? d : { ...d, activities: d.activities.filter((_, ai) => ai !== actIdx) }
    ),
  }
}

function moveActivityToDay(it: Itinerary, fromDayIdx: number, actIdx: number, toDayIdx: number): Itinerary {
  const activity = it.days[fromDayIdx]?.activities[actIdx]
  if (!activity) return it
  return {
    ...it,
    days: it.days.map((d, di) => {
      if (di === fromDayIdx) return { ...d, activities: d.activities.filter((_, ai) => ai !== actIdx) }
      if (di === toDayIdx) return { ...d, activities: [...d.activities, activity] }
      return d
    }),
  }
}

function patchTip(it: Itinerary, tipIdx: number, value: string): Itinerary {
  return { ...it, tips: it.tips.map((t, i) => i !== tipIdx ? t : value) }
}

function removeTip(it: Itinerary, tipIdx: number): Itinerary {
  return { ...it, tips: it.tips.filter((_, i) => i !== tipIdx) }
}

function appendTip(it: Itinerary): Itinerary {
  return { ...it, tips: [...it.tips, ''] }
}

// ── Activity card (sortable) ──────────────────────────────────────────────────

interface ActivityCardProps {
  act: Activity
  index: number
  dayIdx: number
  actIdx: number
  totalDays: number
  totalActivities: number
  editingId: string | null
  editingValue: string
  isDragging?: boolean
  onEditStart: (id: string, value: string) => void
  onEditCommit: (id: string, value: string) => void
  onEditCancel: () => void
  onEditValueChange: (v: string) => void
  onDelete: () => void
  onMoveToDay: (toDayIdx: number) => void
  isSelected?: boolean
  onSelect?: () => void
}

function ActivityCard({
  act,
  dayIdx,
  actIdx,
  totalDays,
  editingId,
  editingValue,
  isDragging = false,
  onEditStart,
  onEditCommit,
  onEditCancel,
  onEditValueChange,
  onDelete,
  onMoveToDay,
  isSelected = false,
  onSelect,
}: ActivityCardProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const eid = (field: string) => `act:${dayIdx}:${actIdx}:${field}`

  function handleKeyDown(e: React.KeyboardEvent, id: string, multiline = false) {
    if (e.key === 'Escape') { e.preventDefault(); onEditCancel(); return }
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); onEditCommit(id, editingValue) }
  }

  function EditableText({ field, value, inputCls }: { field: string; value: string; inputCls?: string }) {
    const id = eid(field)
    if (editingId === id) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          autoFocus
          value={editingValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={() => onEditCommit(id, editingValue)}
          onKeyDown={(e) => handleKeyDown(e, id)}
          className={inputCls ?? 'w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-inherit outline-none ring-1 ring-[#5f7d59]/40'}
        />
      )
    }
    return (
      <span
        role="button" tabIndex={0}
        onClick={() => onEditStart(id, value)}
        onKeyDown={(e) => e.key === 'Enter' && onEditStart(id, value)}
        className="group/edit inline-flex cursor-text items-baseline gap-1"
        title="Click to edit"
      >
        {value}
        <span className="opacity-0 text-[10px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
      </span>
    )
  }

  return (
    <div
      onClick={onSelect}
      className={`group/card relative min-w-0 flex-1 rounded-2xl border bg-[#fffaf1] p-3 shadow-sm transition ${
        isSelected ? 'border-[#5f7d59] ring-2 ring-[#5f7d59]/15' : 'border-[#dfd4c5]'
      } ${isDragging ? 'opacity-40' : 'hover:border-[#cdbca4] hover:bg-white hover:shadow-[0_12px_28px_rgba(75,58,36,0.08)]'}`}
    >
      {/* Action buttons — visible on hover */}
      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition group-hover/card:opacity-100">
        {totalDays > 1 && (
          <div className="relative flex items-center gap-1">
            {totalDays <= 5 ? (
              Array.from({ length: totalDays }, (_, di) => di).filter((di) => di !== dayIdx).map((di) => (
                <button
                  key={di}
                  type="button"
                  onClick={() => onMoveToDay(di)}
                  className="flex h-5 items-center justify-center rounded-full bg-[#e1eadb] px-2 text-[10px] font-bold text-[#526931] transition hover:bg-[#5f7d59] hover:text-white"
                  title={`Move to Day ${di + 1}`}
                >
                  →D{di + 1}
                </button>
              ))
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowMoveMenu((v) => !v)}
                  className="flex h-5 items-center justify-center rounded-full bg-[#e1eadb] px-2 text-[10px] font-bold text-[#526931] transition hover:bg-[#5f7d59] hover:text-white"
                  title="Move to another day"
                >
                  → Day
                </button>
                {showMoveMenu && (
                  <div className="absolute right-0 top-6 z-20 min-w-[100px] rounded-xl border border-[#d8c9b5] bg-white py-1 shadow-lg">
                    {Array.from({ length: totalDays }, (_, di) => di).filter((di) => di !== dayIdx).map((di) => (
                      <button
                        key={di}
                        type="button"
                        onClick={() => { onMoveToDay(di); setShowMoveMenu(false) }}
                        className="w-full px-3 py-1.5 text-left text-xs font-semibold text-[#3e3021] transition hover:bg-[#f4efe7]"
                      >
                        Day {di + 1}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="flex h-5 w-5 items-center justify-center rounded-full text-[#c4b09a] transition hover:bg-rose-50 hover:text-rose-500"
          title="Remove this stop"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pr-16">
        <span className="rounded-full bg-[#f0e4d4] px-2.5 py-1 text-[11px] font-bold text-[#66523b]">
          {act.startTime ?? act.time}{act.endTime ? `–${act.endTime}` : ''}
        </span>
        {act.durationMinutes != null && <span className="text-[11px] font-medium text-[#a69682]">{act.durationMinutes} min</span>}
        {act.isFixedTime && (
          <span className="rounded-full bg-[#fff0c2] px-2.5 py-1 text-[11px] font-semibold text-[#8a641f]">fixed time</span>
        )}
        {editingId === eid('type') ? (
          <select
            autoFocus
            value={editingValue}
            onChange={(e) => onEditCommit(eid('type'), e.target.value)}
            onBlur={onEditCancel}
            onKeyDown={(e) => e.key === 'Escape' && onEditCancel()}
            className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize outline-none ${TYPE_COLORS[editingValue as Activity['type']] ?? ''}`}
          >
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <span
            role="button" tabIndex={0}
            onClick={() => onEditStart(eid('type'), act.type)}
            onKeyDown={(e) => e.key === 'Enter' && onEditStart(eid('type'), act.type)}
            className={`ml-auto cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition hover:opacity-70 ${TYPE_COLORS[act.type]}`}
            title="Click to change type"
          >
            {act.type}
          </span>
        )}
      </div>

      <div className="mt-2 text-sm font-bold text-[#2f2419]">
        <EditableText
          field="title"
          value={act.title}
          inputCls="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-sm font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
        />
      </div>

      <p className="mt-1 truncate text-xs font-medium text-[#8a7965]">
        <EditableText
          field="loc"
          value={act.location}
          inputCls="rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-xs font-medium text-[#8a7965] outline-none ring-1 ring-[#5f7d59]/40"
        />
      </p>

      {act.hoursWarning && (
        <div
          className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5"
          title={act.hoursSource ? `Source: ${act.hoursSource}` : undefined}
        >
          <span className="mt-px shrink-0 text-amber-500 text-xs">⚠</span>
          <span className="text-[11px] font-medium leading-4 text-amber-700">{act.hoursWarning}</span>
        </div>
      )}
      {!act.hoursWarning && act.hoursNote && (
        <p className="mt-2 text-[11px] text-[#9e8c78]">🕐 {act.hoursNote}</p>
      )}
    </div>
  )
}

interface TransitSegmentRowProps {
  previous: Activity
  current: Activity
  currentIndex: number
  option: TravelOption
  status: ReturnType<typeof travelGapStatus>
  onSelect: () => void
}

function TransitSegmentRow({ previous, current, currentIndex, option, status, onSelect }: TransitSegmentRowProps) {
  const window = travelWindow(previous, option.durationMinutes)
  const hasConflict = status?.type === 'conflict'
  const statusText = hasConflict
    ? `short ${formatMinutes(status.shortBy)}`
    : status && status.buffer > 0
      ? `${formatMinutes(status.buffer)} buffer`
      : null

  return (
    <div className="grid gap-3 md:grid-cols-[80px_minmax(0,1fr)]">
      <div className="text-left md:text-right">
        <div className="text-[10px] font-semibold text-[#9a876f]">
          {window ? `${window.start} – ${window.end}` : 'Between stops'}
        </div>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="group flex min-w-0 items-center gap-2 py-0.5 text-left"
        title={`${option.description} to ${current.title}`}
      >
        <span className={`h-px w-8 shrink-0 ${hasConflict ? 'bg-amber-300' : 'bg-[#d7c8b3]'}`} />
        <span className={`flex h-5 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
          hasConflict ? 'bg-amber-100 text-amber-700' : 'bg-[#e1eadb] text-[#526931]'
        }`}>
          {MODE_BADGES[option.mode]}
        </span>
        <span className="min-w-0 truncate text-[11px] font-semibold text-[#75624c] transition group-hover:text-[#2f2419]">
          {MODE_LABELS[option.mode]} · {option.routeName ?? `to stop ${currentIndex + 1}`} · {formatMinutes(option.durationMinutes)}
        </span>
        {option.source === 'google' && (
          <span className="hidden shrink-0 rounded-full bg-[#f1eadf] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#9a876f] sm:inline">
            Google
          </span>
        )}
        {statusText && (
          <span className={`hidden shrink-0 text-[10px] font-semibold sm:inline ${hasConflict ? 'text-amber-700' : 'text-[#6f8a68]'}`}>
            {statusText}
          </span>
        )}
        <span className={`h-px min-w-3 flex-1 ${hasConflict ? 'bg-amber-300' : 'bg-[#d7c8b3]'}`} />
      </button>
    </div>
  )
}

// ── Sortable wrapper ──────────────────────────────────────────────────────────

interface SortableActivityRowProps extends ActivityCardProps {
  dragId: string
}

function SortableActivityRow(props: SortableActivityRowProps) {
  const { dragId, index, totalActivities } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dragId })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const act = props.act

  return (
    <div ref={setNodeRef} style={style} className="grid gap-3 md:grid-cols-[80px_minmax(0,1fr)]">
      {/* Time + duration column */}
      <div className="pt-3 text-left md:text-right">
        <div className="text-xs font-bold text-[#3e3021]">
          {props.editingId === `act:${props.dayIdx}:${props.actIdx}:startTime` ? (
            <input
              autoFocus type="time"
              value={props.editingValue}
              onChange={(e) => props.onEditValueChange(e.target.value)}
              onBlur={() => props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:startTime`, props.editingValue)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); props.onEditCancel() }
                if (e.key === 'Enter') { e.preventDefault(); props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:startTime`, props.editingValue) }
              }}
              className="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-1 py-0.5 text-xs outline-none ring-1 ring-[#5f7d59]/40"
            />
          ) : (
            <span
              role="button" tabIndex={0}
              onClick={() => props.onEditStart(`act:${props.dayIdx}:${props.actIdx}:startTime`, act.startTime ?? '')}
              onKeyDown={(e) => e.key === 'Enter' && props.onEditStart(`act:${props.dayIdx}:${props.actIdx}:startTime`, act.startTime ?? '')}
              className="group/edit inline-flex cursor-text items-baseline gap-0.5"
              title="Click to edit start time"
            >
              {act.startTime ?? act.time}
              <span className="opacity-0 text-[9px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
            </span>
          )}
          {act.endTime && (
            <>
              {' – '}
              {props.editingId === `act:${props.dayIdx}:${props.actIdx}:endTime` ? (
                <input
                  autoFocus type="time"
                  value={props.editingValue}
                  onChange={(e) => props.onEditValueChange(e.target.value)}
                  onBlur={() => props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:endTime`, props.editingValue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); props.onEditCancel() }
                    if (e.key === 'Enter') { e.preventDefault(); props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:endTime`, props.editingValue) }
                  }}
                  className="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-1 py-0.5 text-xs outline-none ring-1 ring-[#5f7d59]/40"
                />
              ) : (
                <span
                  role="button" tabIndex={0}
                  onClick={() => props.onEditStart(`act:${props.dayIdx}:${props.actIdx}:endTime`, act.endTime ?? '')}
                  onKeyDown={(e) => e.key === 'Enter' && props.onEditStart(`act:${props.dayIdx}:${props.actIdx}:endTime`, act.endTime ?? '')}
                  className="group/edit inline-flex cursor-text items-baseline gap-0.5"
                  title="Click to edit end time"
                >
                  {act.endTime}
                  <span className="opacity-0 text-[9px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
                </span>
              )}
            </>
          )}
        </div>
        {act.durationMinutes != null && (
          <div className="mt-0.5 text-[11px] font-medium text-[#a69682]">
            {props.editingId === `act:${props.dayIdx}:${props.actIdx}:dur` ? (
              <input
                autoFocus type="number" min={1}
                value={props.editingValue}
                onChange={(e) => props.onEditValueChange(e.target.value)}
                onBlur={() => props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:dur`, props.editingValue)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); props.onEditCancel() }
                  if (e.key === 'Enter') { e.preventDefault(); props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:dur`, props.editingValue) }
                }}
                className="w-14 rounded border border-[#bca98d] bg-[#fffdf8] px-1 py-0.5 text-[11px] outline-none ring-1 ring-[#5f7d59]/40"
              />
            ) : (
              <span
                role="button" tabIndex={0}
                onClick={() => props.onEditStart(`act:${props.dayIdx}:${props.actIdx}:dur`, String(act.durationMinutes ?? ''))}
                onKeyDown={(e) => e.key === 'Enter' && props.onEditStart(`act:${props.dayIdx}:${props.actIdx}:dur`, String(act.durationMinutes ?? ''))}
                className="group/edit inline-flex cursor-text items-baseline gap-0.5"
                title="Click to edit duration"
              >
                {act.durationMinutes} min
                <span className="opacity-0 text-[9px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card + drag handle + connector */}
      <div className="relative flex gap-2">
        <div className="flex flex-col items-center">
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="mt-3 cursor-grab touch-none select-none rounded-lg p-1 text-[#c4b09a] transition hover:bg-[#f0e4d4] hover:text-[#75624c] active:cursor-grabbing"
            title="Drag to reorder"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="4" cy="3" r="1.2" /><circle cx="10" cy="3" r="1.2" />
              <circle cx="4" cy="7" r="1.2" /><circle cx="10" cy="7" r="1.2" />
              <circle cx="4" cy="11" r="1.2" /><circle cx="10" cy="11" r="1.2" />
            </svg>
          </button>
          <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-xl bg-[#5f7d59] text-[11px] font-bold text-white shadow-sm">
            {index + 1}
          </span>
          {index < totalActivities - 1 && <span className="w-px flex-1 bg-[#d7c8b3]" />}
        </div>

        <ActivityCard {...props} isDragging={isDragging} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  itinerary: Itinerary
  savedTripTitle: string | null
  savedTripId: string | null
  isSaving: boolean
  saveStatus: string | null
  saveError: string | null
  onSave: () => void
  onUpdateItinerary?: (itinerary: Itinerary) => void
  onOverview?: () => void
  onBackToDashboard?: () => void
}

export function ItineraryDashboard({ itinerary, savedTripTitle, savedTripId, isSaving, saveStatus, saveError, onSave, onUpdateItinerary, onOverview, onBackToDashboard }: Props) {
  const [activeDay, setActiveDay] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [contextTab, setContextTab] = useState<'map' | 'details' | 'notes'>('map')
  const [selectedActivityIndex, setSelectedActivityIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const safeActiveDay = Math.min(activeDay, Math.max(itinerary.days.length - 1, 0))
  const day = itinerary.days[safeActiveDay]
  const dayLocations = useMemo(() => (day ? getDayLocations(day) : []), [day])
  const activeKeyLocations = itinerary.keyLocations.filter((l) => !day || l.day === day.day)
  const mapLocations = dayLocations.length > 0 ? dayLocations : activeKeyLocations.length > 0 ? activeKeyLocations : itinerary.keyLocations
  const mapCenter = getLocationCenter(mapLocations, itinerary.mapCenter)
  const currentDayWindow = dayWindow(day?.startTime ?? itinerary.trip.dailyStartTime, day?.endTime ?? itinerary.trip.dailyEndTime)
  const dayTravelMinutes = day?.activities.reduce((t, a) => t + (travelOptionsForActivity(a)[0]?.durationMinutes ?? 0), 0) ?? 0
  const days = itinerary.days.length
  const travelers = itinerary.trip.travelers
  const selectedActivityIdx = Math.min(selectedActivityIndex, Math.max((day?.activities.length ?? 1) - 1, 0))
  const selectedActivity = day?.activities[selectedActivityIdx] ?? null
  const selectedPreviousActivity = selectedActivityIdx > 0 ? day?.activities[selectedActivityIdx - 1] : undefined
  const selectedTravelOptions = selectedActivity ? travelOptionsForActivity(selectedActivity) : []
  const selectedTravelStatus = travelGapStatus(selectedPreviousActivity, selectedActivity, selectedTravelOptions[0]?.durationMinutes)
  const displayTitle = savedTripTitle?.trim() || itinerary.trip.destination

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activityIds = day?.activities.map((_, i) => `act:${safeActiveDay}:${i}`) ?? []

  const draggingActivity = useMemo(() => {
    if (!draggingId) return null
    const parts = draggingId.split(':')
    return itinerary.days[Number(parts[1])]?.activities[Number(parts[2])] ?? null
  }, [draggingId, itinerary])

  function startEdit(id: string, value: string) { setEditingId(id); setEditingValue(value) }
  function cancelEdit() { setEditingId(null) }

  function commitEdit(id: string, value: string) {
    if (!onUpdateItinerary) { setEditingId(null); return }
    const parts = id.split(':')
    let updated = itinerary

    if (parts[0] === 'summary') {
      updated = { ...itinerary, summary: value }
    } else if (parts[0] === 'tip') {
      updated = patchTip(itinerary, Number(parts[1]), value)
    } else if (parts[0] === 'day') {
      if (parts[2] === 'theme') updated = patchDay(itinerary, Number(parts[1]), { theme: value })
    } else if (parts[0] === 'act') {
      const [, di, ai, field] = parts
      const dayIdx = Number(di), actIdx = Number(ai)
      if (field === 'title') updated = patchActivity(itinerary, dayIdx, actIdx, { title: value })
      else if (field === 'desc') updated = patchActivity(itinerary, dayIdx, actIdx, { description: value })
      else if (field === 'loc') updated = patchActivity(itinerary, dayIdx, actIdx, { location: value })
      else if (field === 'startTime' || field === 'endTime' || field === 'dur') {
        const activity = itinerary.days[dayIdx]?.activities[actIdx]
        updated = activity ? patchActivityAndShiftFollowing(itinerary, dayIdx, actIdx, buildTimePatch(activity, field, value)) : itinerary
      }
      else if (field === 'type') updated = patchActivity(itinerary, dayIdx, actIdx, { type: value as Activity['type'] })
    }

    onUpdateItinerary(updated)
    setEditingId(null)
  }

  function handleDragStart(event: DragStartEvent) { setDraggingId(String(event.active.id)); setEditingId(null) }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over || active.id === over.id || !onUpdateItinerary) return
    const parts = String(active.id).split(':')
    const overParts = String(over.id).split(':')
    onUpdateItinerary(reorderActivitiesAndReschedule(itinerary, Number(parts[1]), Number(parts[2]), Number(overParts[2])))
  }

  const commonCardProps = {
    dayIdx: safeActiveDay,
    totalDays: days,
    editingId,
    editingValue,
    onEditStart: startEdit,
    onEditCommit: commitEdit,
    onEditCancel: cancelEdit,
    onEditValueChange: setEditingValue,
  }

  // ── Inline editable fields used in the header / day strip ──────────────────

  function InlineText({ id, value, cls, inputCls }: { id: string; value: string; cls?: string; inputCls?: string }) {
    if (editingId === id) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          autoFocus value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitEdit(id, editingValue)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(id, editingValue) }
          }}
          className={inputCls ?? `rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-inherit outline-none ring-1 ring-[#5f7d59]/40 ${cls ?? ''}`}
        />
      )
    }
    return (
      <span
        role="button" tabIndex={0}
        onClick={() => startEdit(id, value)}
        onKeyDown={(e) => e.key === 'Enter' && startEdit(id, value)}
        className={`group/edit inline-flex cursor-text items-baseline gap-1 ${cls ?? ''}`}
        title="Click to edit"
      >
        {value}
        <span className="opacity-0 text-[10px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
      </span>
    )
  }

  function InlineArea({ id, value, rows = 4, cls, textareaCls, placeholder }: { id: string; value: string; rows?: number; cls?: string; textareaCls?: string; placeholder?: string }) {
    if (editingId === id) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          autoFocus
          value={editingValue}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitEdit(id, editingValue)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelEdit() } }}
          className={textareaCls ?? 'w-full resize-none rounded-xl border border-[#bca98d] bg-[#fffdf8] px-3 py-2 text-sm leading-6 text-[#5f4c36] outline-none ring-1 ring-[#5f7d59]/40'}
        />
      )
    }
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => startEdit(id, value)}
        onKeyDown={(e) => e.key === 'Enter' && startEdit(id, value)}
        className={`group/edit inline-flex cursor-text items-start gap-1 ${cls ?? ''}`}
        title="Click to edit"
      >
        <span>{value || <span className="italic text-[#b7a791]">{placeholder ?? 'Add details'}</span>}</span>
        <span className="mt-0.5 shrink-0 opacity-0 text-[10px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
      </span>
    )
  }

  function SummaryArea() {
    if (editingId === 'summary') {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          autoFocus value={editingValue} rows={3}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitEdit('summary', editingValue)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelEdit() } }}
          className="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-1 text-sm leading-6 text-[#5f4c36] outline-none ring-1 ring-[#5f7d59]/40 resize-none"
        />
      )
    }
    return (
      <span
        role="button" tabIndex={0}
        onClick={() => startEdit('summary', itinerary.summary)}
        onKeyDown={(e) => e.key === 'Enter' && startEdit('summary', itinerary.summary)}
        className="group/edit inline-flex cursor-text items-start gap-1 text-sm leading-6 text-[#5f4c36]"
        title="Click to edit summary"
      >
        <span>{itinerary.summary}</span>
        <span className="mt-0.5 shrink-0 opacity-0 text-[10px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
      </span>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f4efe7] text-[#3e3021]">

      <div className="shrink-0 border-b border-[#dfd4c5] bg-[#fbf7ef] px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset] sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-[#2f2419]">{displayTitle}</h1>
            <div className="mt-1 flex items-center gap-2 overflow-x-auto text-[11px] font-medium text-[#8a7965]">
              <span className="shrink-0">{itinerary.trip.startDate} – {itinerary.trip.endDate}</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-[#c8b89e]" />
              <span className="shrink-0">{days} {days === 1 ? 'day' : 'days'}</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-[#c8b89e]" />
              <span className="shrink-0">{travelers} {travelers === 1 ? 'traveler' : 'travelers'}</span>
              {itinerary.trip.accommodationLocation && (
                <>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[#c8b89e]" />
                  <span className="shrink-0">Staying near {itinerary.trip.accommodationLocation}</span>
                </>
              )}
              {(itinerary.trip.dailyStartTime || itinerary.trip.dailyEndTime) && (
                <>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[#c8b89e]" />
                  <span className="shrink-0">
                    {itinerary.trip.dailyStartTime ?? '09:00'}–{itinerary.trip.dailyEndTime ?? '21:00'}
                  </span>
                </>
              )}
              {(saveStatus || saveError) && (
                <>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[#c8b89e]" />
                  <span className={`shrink-0 ${saveError ? 'text-rose-600' : 'text-[#4f7b4d]'}`}>{saveError ?? saveStatus}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="rounded-full border border-[#d1c0aa] bg-[#fffaf1] px-3.5 py-2 text-xs font-semibold text-[#5c4630] transition hover:border-[#bca98d] hover:bg-white"
              >
                Dashboard
              </button>
            )}
            {savedTripId && onOverview && (
              <button
                type="button"
                onClick={onOverview}
                className="rounded-full border border-[#d1c0aa] bg-[#fffaf1] px-3.5 py-2 text-xs font-semibold text-[#5c4630] transition hover:border-[#bca98d] hover:bg-white"
              >
                Preview
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-full bg-[#5f7d59] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#4f6b49] disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : savedTripId ? 'Save changes' : 'Save trip'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <section className="flex min-h-[62dvh] flex-col border-b border-[#dfd4c5] lg:min-h-0 lg:w-[58%] lg:border-b-0 lg:border-r">
          {/* Day tabs */}
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-[#dfd4c5] bg-[#fbf7ef]/70 px-3 py-2 sm:px-4">
            {itinerary.days.map((d, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveDay(i)
                  setSelectedActivityIndex(0)
                  setContextTab('map')
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                  safeActiveDay === i
                    ? 'border-[#5f7d59] bg-[#5f7d59] text-white'
                    : 'border-[#d8c9b5] bg-[#fffaf1] text-[#75624c] hover:border-[#bca98d] hover:bg-white'
                }`}
              >
                Day {d.day}
              </button>
            ))}
          </div>

          {/* Scrollable content: day strip + activities */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
            {day && (
              <>
                {/* ── Cut 2: Slim day strip (replaces the large card) ── */}
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#e8ddd0] pb-3">
                  <h3 className="text-sm font-bold text-[#2f2419]">
                    <InlineText
                      id={`day:${safeActiveDay}:theme`}
                      value={day.theme}
                      inputCls="rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-sm font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
                    />
                  </h3>
                  <span className="text-[11px] text-[#a69682]">{day.date}{currentDayWindow ? ` · ${currentDayWindow}` : ''}</span>
                  <span className="flex w-full gap-1.5 text-[11px] font-semibold text-[#66523b] sm:ml-auto sm:w-auto">
                    <span className="rounded-full bg-[#f0e4d4] px-2.5 py-0.5">{day.activities.length} stops</span>
                    <span className="rounded-full bg-[#e1eadb] px-2.5 py-0.5">{formatMinutes(dayTravelMinutes)} travel</span>
                  </span>
                </div>

                {/* Sortable activity list */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={activityIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {day.activities.map((act, i) => {
                        const nextActivity = day.activities[i + 1]
                        const transitOption = nextActivity ? travelOptionsForActivity(nextActivity)[0] : null
                        const transitStatus = transitOption ? travelGapStatus(act, nextActivity, transitOption.durationMinutes) : null

                        return (
                          <Fragment key={`act-group:${safeActiveDay}:${i}`}>
                            <SortableActivityRow
                              dragId={`act:${safeActiveDay}:${i}`}
                              act={act}
                              index={i}
                              actIdx={i}
                              totalActivities={day.activities.length}
                              onDelete={() => onUpdateItinerary?.(removeActivity(itinerary, safeActiveDay, i))}
                              onMoveToDay={(toDayIdx) => onUpdateItinerary?.(moveActivityToDay(itinerary, safeActiveDay, i, toDayIdx))}
                              isSelected={i === selectedActivityIdx}
                              onSelect={() => {
                                setSelectedActivityIndex(i)
                                setContextTab('details')
                              }}
                              {...commonCardProps}
                            />
                            {nextActivity && transitOption && (
                              <TransitSegmentRow
                                previous={act}
                                current={nextActivity}
                                currentIndex={i + 1}
                                option={transitOption}
                                status={transitStatus}
                                onSelect={() => {
                                  setSelectedActivityIndex(i + 1)
                                  setContextTab('details')
                                }}
                              />
                            )}
                          </Fragment>
                        )
                      })}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {draggingActivity && (
                      <div className="rotate-1 rounded-[24px] border border-[#dfd4c5] bg-[#fffaf1] p-4 opacity-95 shadow-2xl">
                        <p className="text-base font-bold text-[#2f2419]">{draggingActivity.title}</p>
                        <p className="mt-1 text-xs font-medium text-[#8a7965]">{draggingActivity.location}</p>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>

                <div className="h-4" />
              </>
            )}
          </div>
        </section>

        <aside className="flex min-h-[460px] w-full flex-col p-3 sm:p-4 lg:min-h-0 lg:min-w-[360px] lg:flex-1">
          <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-[#dfd4c5] bg-[#fffaf1] p-3 shadow-[0_18px_40px_rgba(75,58,36,0.08)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f8a68]">Context panel</p>
                <h3 className="mt-0.5 text-sm font-bold text-[#2f2419]">Day {day?.day ?? 1}</h3>
              </div>
              <div className="inline-flex rounded-full border border-[#dfd4c5] bg-[#f7f1e9] p-1">
                {(['map', 'details', 'notes'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setContextTab(tab)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold capitalize transition ${
                      contextTab === tab
                        ? 'bg-[#5f7d59] text-white shadow-sm'
                        : 'text-[#75624c] hover:bg-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {contextTab === 'map' && (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="min-h-[300px] flex-1 overflow-hidden rounded-[18px] border border-[#d1c0aa] bg-[#e9e1d4] lg:min-h-0">
                  <MapView center={mapCenter} locations={mapLocations} activeDay={day?.day} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-[#e4d8c9] bg-[#fbf7ef] px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a876f]">Pins</p>
                    <p className="mt-1 text-sm font-bold text-[#2f2419]">{mapLocations.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#e4d8c9] bg-[#fbf7ef] px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a876f]">Travel</p>
                    <p className="mt-1 text-sm font-bold text-[#2f2419]">{formatMinutes(dayTravelMinutes)}</p>
                  </div>
                  <div className="rounded-2xl border border-[#e4d8c9] bg-[#fbf7ef] px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a876f]">Stops</p>
                    <p className="mt-1 text-sm font-bold text-[#2f2419]">{day?.activities.length ?? 0}</p>
                  </div>
                </div>
              </div>
            )}

            {contextTab === 'details' && (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[20px] border border-[#e4d8c9] bg-[#fbf7ef] px-4 py-4">
                {selectedActivity ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f8a68]">Selected stop</p>
                      <h3 className="mt-1 text-lg font-bold text-[#2f2419]">
                        <InlineText
                          id={`act:${safeActiveDay}:${selectedActivityIdx}:title`}
                          value={selectedActivity.title}
                          inputCls="w-full rounded-xl border border-[#bca98d] bg-[#fffdf8] px-3 py-2 text-lg font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
                        />
                      </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-[#e4d8c9] bg-[#fffaf1] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a876f]">Start</p>
                        <p className="mt-1 text-sm font-bold text-[#2f2419]">
                          <InlineText
                            id={`act:${safeActiveDay}:${selectedActivityIdx}:startTime`}
                            value={selectedActivity.startTime ?? ''}
                            inputCls="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-1 py-0.5 text-sm font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
                          />
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#e4d8c9] bg-[#fffaf1] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a876f]">End</p>
                        <p className="mt-1 text-sm font-bold text-[#2f2419]">
                          <InlineText
                            id={`act:${safeActiveDay}:${selectedActivityIdx}:endTime`}
                            value={selectedActivity.endTime ?? ''}
                            inputCls="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-1 py-0.5 text-sm font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
                          />
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#e4d8c9] bg-[#fffaf1] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a876f]">Stay</p>
                        <p className="mt-1 text-sm font-bold text-[#2f2419]">
                          <InlineText
                            id={`act:${safeActiveDay}:${selectedActivityIdx}:dur`}
                            value={String(selectedActivity.durationMinutes ?? '')}
                            inputCls="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-1 py-0.5 text-sm font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
                          /> min
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className={`rounded-full border px-3 py-1.5 capitalize ${TYPE_COLORS[selectedActivity.type]}`}>
                        {selectedActivity.type}
                      </span>
                      {selectedActivity.isFixedTime && (
                        <span className="rounded-full bg-[#fff0c2] px-3 py-1.5 text-[#8a641f]">fixed time</span>
                      )}
                    </div>

                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a876f]">Location</p>
                      <p className="text-sm font-semibold text-[#5f4c36]">
                        <InlineText
                          id={`act:${safeActiveDay}:${selectedActivityIdx}:loc`}
                          value={selectedActivity.location}
                          inputCls="w-full rounded-xl border border-[#bca98d] bg-[#fffdf8] px-3 py-2 text-sm font-semibold text-[#5f4c36] outline-none ring-1 ring-[#5f7d59]/40"
                        />
                      </p>
                    </div>

                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a876f]">Description</p>
                      <InlineArea
                        id={`act:${safeActiveDay}:${selectedActivityIdx}:desc`}
                        value={selectedActivity.description}
                        placeholder="Add a useful note for this stop"
                        cls="text-sm leading-6 text-[#5f4c36]"
                      />
                    </div>

                    <div className="rounded-2xl border border-[#e4d8c9] bg-[#fffaf1] px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a876f]">Route options</p>
                        {selectedTravelOptions.length > 0 && (
                          <span className="text-[10px] font-bold text-[#8a7965]">
                            {selectedTravelOptions.some((option) => option.source === 'google') ? 'Google routes' : `Top ${selectedTravelOptions.length}`}
                          </span>
                        )}
                      </div>
                      {selectedTravelOptions.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {selectedTravelOptions.map((option, optionIdx) => (
                            <div key={`${option.mode}-${optionIdx}`} className="flex gap-3 rounded-2xl border border-[#eadfce] bg-[#fbf7ef] px-3 py-2">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e1eadb] text-[10px] font-black text-[#526931]">
                                {MODE_BADGES[option.mode]}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="text-sm font-bold text-[#2f2419]">
                                    {option.durationMinutes} min · {option.routeName ?? MODE_LABELS[option.mode]}
                                  </p>
                                  {(option.recommended || optionIdx === 0) && (
                                    <span className="rounded-full bg-[#5f7d59] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">Best</span>
                                  )}
                                  {option.cost && <span className="text-[11px] font-semibold text-[#8a7965]">{option.cost}</span>}
                                </div>
                                <p className="mt-0.5 text-xs leading-5 text-[#66523b]">{option.description}</p>
                              </div>
                            </div>
                          ))}
                          {selectedTravelStatus && (
                            <div className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${
                              selectedTravelStatus.type === 'conflict'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-[#d9e6cf] bg-[#f3f8ee] text-[#526931]'
                            }`}>
                              {selectedTravelStatus.type === 'conflict'
                                ? `Timing conflict: only ${formatMinutes(Math.max(selectedTravelStatus.available, 0))} is available between stops, but travel needs about ${formatMinutes(selectedTravelStatus.needed)}. Short by ${formatMinutes(selectedTravelStatus.shortBy)}.`
                                : `Travel fits: ${formatMinutes(selectedTravelStatus.needed)} travel with about ${formatMinutes(selectedTravelStatus.buffer)} buffer.`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-[#8a7965]">
                          No route is needed for the first stop of the day.
                        </p>
                      )}
                    </div>

                    <div className={`rounded-2xl border px-3 py-3 ${
                      selectedActivity.hoursWarning
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-[#e4d8c9] bg-[#fffaf1] text-[#5f4c36]'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a876f]">Hours</p>
                        <span className="text-[10px] font-bold text-[#8a7965]">{hoursSourceLabel(selectedActivity.hoursSource)}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6">
                        {selectedActivity.hoursWarning ?? selectedActivity.hoursNote ?? 'No verified opening hours yet.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center text-center text-sm text-[#8a7965]">
                    Select a stop to edit its details.
                  </div>
                )}
              </div>
            )}

            {contextTab === 'notes' && (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[20px] border border-[#e4d8c9] bg-[#fbf7ef] px-4 py-4">
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f8a68]">Trip summary</p>
                  <SummaryArea />
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f8a68]">Planning notes</p>
                    {onUpdateItinerary && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = appendTip(itinerary)
                          onUpdateItinerary(updated)
                          startEdit(`tip:${updated.tips.length - 1}`, '')
                        }}
                        className="text-[11px] font-semibold text-[#6f8a68] transition hover:text-[#5f7d59]"
                      >
                        + Add note
                      </button>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {itinerary.tips.map((tip, i) => (
                      <li key={i} className="group/tip flex items-start gap-2 rounded-2xl border border-[#e4d8c9] bg-[#fffaf1] px-3 py-2 text-xs leading-5 text-[#75624c]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8ba27e]" />
                        {editingId === `tip:${i}` ? (
                          <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => commitEdit(`tip:${i}`, editingValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                              if (e.key === 'Enter') { e.preventDefault(); commitEdit(`tip:${i}`, editingValue) }
                            }}
                            className="flex-1 rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-xs text-[#75624c] outline-none ring-1 ring-[#5f7d59]/40"
                          />
                        ) : (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => startEdit(`tip:${i}`, tip)}
                            onKeyDown={(e) => e.key === 'Enter' && startEdit(`tip:${i}`, tip)}
                            className="group/edit flex-1 cursor-text"
                            title="Click to edit"
                          >
                            {tip || <span className="italic text-[#b7a791]">empty note</span>}
                            <span className="ml-1 opacity-0 text-[9px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
                          </span>
                        )}
                        {onUpdateItinerary && (
                          <button
                            type="button"
                            onClick={() => onUpdateItinerary(removeTip(itinerary, i))}
                            className="mt-0.5 shrink-0 text-[#c4b09a] opacity-0 transition hover:text-rose-500 group-hover/tip:opacity-100"
                            title="Remove note"
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                    {itinerary.tips.length === 0 && (
                      <li className="rounded-2xl border border-dashed border-[#d8c9b5] px-3 py-4 text-center text-xs text-[#9a876f]">
                        No notes yet.
                      </li>
                    )}
                  </ul>
                </div>

                <div className="mt-5 rounded-2xl border border-[#e4d8c9] bg-[#fffaf1] px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f8a68]">Quick guide</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#66523b]">
                    Drag <span className="font-semibold">⠿</span> to reorder, use <span className="font-semibold">→D</span> to move stops between days, and click text to edit.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
