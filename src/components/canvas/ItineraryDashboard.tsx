'use client'

import { useMemo, useRef, useState } from 'react'
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
import type { Activity, DayPlan, Itinerary } from '@/types/travel'
import { downloadItineraryMarkdown } from '@/lib/itineraryExport'
import { getDayLocations, getLocationCenter } from '@/lib/itineraryMap'
import { MapView } from './MapView'

const TIME_ICONS: Record<Activity['time'], string> = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌙',
}

const TYPE_COLORS: Record<Activity['type'], string> = {
  food: 'bg-[#f8dfad] text-[#765320] border-[#e9c98f]',
  attraction: 'bg-[#cfe6ef] text-[#315d69] border-[#accbd6]',
  transport: 'bg-[#e7dfd2] text-[#64523d] border-[#d3c5b0]',
  accommodation: 'bg-[#cfe5d6] text-[#356247] border-[#aac8b3]',
  activity: 'bg-[#d9e8bf] text-[#526931] border-[#bbd39a]',
}

const ACTIVITY_TYPES: Activity['type'][] = ['food', 'attraction', 'transport', 'accommodation', 'activity']

function formatTimeRange(activity: Activity) {
  if (activity.startTime && activity.endTime) return `${activity.startTime} - ${activity.endTime}`
  if (activity.startTime) return activity.startTime
  return activity.time
}

function dayWindow(dayStart?: string, dayEnd?: string) {
  if (dayStart && dayEnd) return `${dayStart} - ${dayEnd}`
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

function reorderActivities(it: Itinerary, dayIdx: number, oldIdx: number, newIdx: number): Itinerary {
  return {
    ...it,
    days: it.days.map((d, di) =>
      di !== dayIdx ? d : { ...d, activities: arrayMove(d.activities, oldIdx, newIdx) }
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
}

function ActivityCard({
  act,
  index,
  dayIdx,
  actIdx,
  totalDays,
  totalActivities,
  editingId,
  editingValue,
  isDragging = false,
  onEditStart,
  onEditCommit,
  onEditCancel,
  onEditValueChange,
  onDelete,
  onMoveToDay,
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

  function EditableArea({ field, value, rows = 3, textareaCls }: { field: string; value: string; rows?: number; textareaCls?: string }) {
    const id = eid(field)
    if (editingId === id) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          autoFocus
          value={editingValue}
          rows={rows}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={() => onEditCommit(id, editingValue)}
          onKeyDown={(e) => handleKeyDown(e, id, true)}
          className={textareaCls ?? 'w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-1 text-inherit leading-6 outline-none ring-1 ring-[#5f7d59]/40 resize-none'}
        />
      )
    }
    return (
      <span
        role="button" tabIndex={0}
        onClick={() => onEditStart(id, value)}
        onKeyDown={(e) => e.key === 'Enter' && onEditStart(id, value)}
        className="group/edit inline-flex cursor-text items-start gap-1"
        title="Click to edit"
      >
        <span>{value}</span>
        <span className="mt-0.5 shrink-0 opacity-0 text-[10px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
      </span>
    )
  }

  return (
    <div className={`group/card relative min-w-0 flex-1 rounded-[24px] border border-[#dfd4c5] bg-[#fffaf1] p-4 shadow-sm transition ${isDragging ? 'opacity-40' : 'hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(75,58,36,0.1)]'}`}>
      {/* Action buttons row — delete + move */}
      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition group-hover/card:opacity-100">
        {/* Move to day */}
        {totalDays > 1 && (
          <div className="relative">
            {totalDays <= 5 ? (
              // Show individual day buttons when ≤ 5 days
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
              // Dropdown for many days
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
        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="flex h-5 w-5 items-center justify-center rounded-full text-[#c4b09a] transition hover:bg-rose-50 hover:text-rose-500"
          title="Remove this stop"
        >
          ×
        </button>
      </div>

      {act.travelFromPrevious && (
        <p className="mb-3 inline-flex rounded-full bg-[#f0e4d4] px-3 py-1 text-[11px] font-semibold text-[#75624c]">
          {act.travelFromPrevious.durationMinutes} min {act.travelFromPrevious.mode}: {act.travelFromPrevious.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base">{TIME_ICONS[act.time]}</span>
        <span className="text-xs font-semibold capitalize text-[#a69682]">{act.time}</span>
        {act.isFixedTime && (
          <span className="rounded-full bg-[#fff0c2] px-2.5 py-1 text-[11px] font-semibold text-[#8a641f]">fixed time</span>
        )}
        {/* Type badge */}
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

      {/* Title */}
      <div className="mt-3 text-base font-bold text-[#2f2419]">
        <EditableText
          field="title"
          value={act.title}
          inputCls="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-base font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
        />
      </div>

      {/* Location */}
      <p className="mt-1 text-xs font-medium text-[#8a7965]">
        Pin:{' '}
        <EditableText
          field="loc"
          value={act.location}
          inputCls="rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-xs font-medium text-[#8a7965] outline-none ring-1 ring-[#5f7d59]/40"
        />
      </p>

      {/* Description */}
      <div className="mt-3 text-sm leading-6 text-[#5f4c36]">
        <EditableArea
          field="desc"
          value={act.description}
          rows={3}
          textareaCls="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-1 text-sm leading-6 text-[#5f4c36] outline-none ring-1 ring-[#5f7d59]/40 resize-none"
        />
      </div>
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const act = props.act

  return (
    <div ref={setNodeRef} style={style} className="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)]">
      {/* Time + duration column */}
      <div className="pt-4 text-left md:text-right">
        <div className="text-xs font-bold text-[#3e3021]">
          {props.editingId === `act:${props.dayIdx}:${props.actIdx}:startTime` ? (
            <input
              autoFocus
              type="time"
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
              {' - '}
              {props.editingId === `act:${props.dayIdx}:${props.actIdx}:endTime` ? (
                <input
                  autoFocus
                  type="time"
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
          <div className="mt-1 text-[11px] font-medium text-[#a69682]">
            {props.editingId === `act:${props.dayIdx}:${props.actIdx}:dur` ? (
              <input
                autoFocus
                type="number"
                min={1}
                value={props.editingValue}
                onChange={(e) => props.onEditValueChange(e.target.value)}
                onBlur={() => props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:dur`, props.editingValue)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); props.onEditCancel() }
                  if (e.key === 'Enter') { e.preventDefault(); props.onEditCommit(`act:${props.dayIdx}:${props.actIdx}:dur`, props.editingValue) }
                }}
                className="w-16 rounded border border-[#bca98d] bg-[#fffdf8] px-1 py-0.5 text-[11px] outline-none ring-1 ring-[#5f7d59]/40"
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

      {/* Card + connector column */}
      <div className="relative flex gap-3">
        {/* Drag handle + number column */}
        <div className="flex flex-col items-center">
          {/* Drag handle */}
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="mt-5 cursor-grab touch-none select-none rounded-lg p-1 text-[#c4b09a] transition hover:bg-[#f0e4d4] hover:text-[#75624c] active:cursor-grabbing"
            title="Drag to reorder"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="4" cy="3" r="1.2" />
              <circle cx="10" cy="3" r="1.2" />
              <circle cx="4" cy="7" r="1.2" />
              <circle cx="10" cy="7" r="1.2" />
              <circle cx="4" cy="11" r="1.2" />
              <circle cx="10" cy="11" r="1.2" />
            </svg>
          </button>
          <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-[#5f7d59] text-xs font-bold text-white shadow-sm">
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
  savedTripId: string | null
  isSaving: boolean
  saveStatus: string | null
  saveError: string | null
  onSave: () => void
  onUpdateItinerary?: (itinerary: Itinerary) => void
  onOverview?: () => void
}

export function ItineraryDashboard({ itinerary, savedTripId, isSaving, saveStatus, saveError, onSave, onUpdateItinerary, onOverview }: Props) {
  const [activeDay, setActiveDay] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const safeActiveDay = Math.min(activeDay, Math.max(itinerary.days.length - 1, 0))
  const day = itinerary.days[safeActiveDay]
  const dayLocations = useMemo(() => (day ? getDayLocations(day) : []), [day])
  const activeKeyLocations = itinerary.keyLocations.filter((location) => !day || location.day === day.day)
  const mapLocations = dayLocations.length > 0
    ? dayLocations
    : activeKeyLocations.length > 0
      ? activeKeyLocations
      : itinerary.keyLocations
  const mapCenter = getLocationCenter(mapLocations, itinerary.mapCenter)
  const currentDayWindow = dayWindow(
    day?.startTime ?? itinerary.trip.dailyStartTime,
    day?.endTime ?? itinerary.trip.dailyEndTime
  )

  const dayTravelMinutes = day?.activities.reduce(
    (total, activity) => total + (activity.travelFromPrevious?.durationMinutes ?? 0),
    0
  ) ?? 0
  const days = itinerary.days.length
  const travelers = itinerary.trip.travelers

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activityIds = day?.activities.map((_, i) => `act:${safeActiveDay}:${i}`) ?? []

  const draggingActivity = useMemo(() => {
    if (!draggingId) return null
    const parts = draggingId.split(':')
    const di = Number(parts[1])
    const ai = Number(parts[2])
    return itinerary.days[di]?.activities[ai] ?? null
  }, [draggingId, itinerary])

  function startEdit(id: string, value: string) {
    setEditingId(id)
    setEditingValue(value)
  }

  function commitEdit(id: string, value: string) {
    if (!onUpdateItinerary) { setEditingId(null); return }
    const parts = id.split(':')
    let updated = itinerary

    if (parts[0] === 'summary') {
      updated = { ...itinerary, summary: value }
    } else if (parts[0] === 'tip') {
      updated = patchTip(itinerary, Number(parts[1]), value)
    } else if (parts[0] === 'day') {
      const dayIdx = Number(parts[1])
      if (parts[2] === 'theme') updated = patchDay(itinerary, dayIdx, { theme: value })
    } else if (parts[0] === 'act') {
      const dayIdx = Number(parts[1])
      const actIdx = Number(parts[2])
      const field = parts[3]
      if (field === 'title') updated = patchActivity(itinerary, dayIdx, actIdx, { title: value })
      else if (field === 'desc') updated = patchActivity(itinerary, dayIdx, actIdx, { description: value })
      else if (field === 'loc') updated = patchActivity(itinerary, dayIdx, actIdx, { location: value })
      else if (field === 'startTime') updated = patchActivity(itinerary, dayIdx, actIdx, { startTime: value || undefined })
      else if (field === 'endTime') updated = patchActivity(itinerary, dayIdx, actIdx, { endTime: value || undefined })
      else if (field === 'dur') updated = patchActivity(itinerary, dayIdx, actIdx, { durationMinutes: value ? Number(value) : undefined })
      else if (field === 'type') updated = patchActivity(itinerary, dayIdx, actIdx, { type: value as Activity['type'] })
    }

    onUpdateItinerary(updated)
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
    setEditingId(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over || active.id === over.id || !onUpdateItinerary) return

    const parts = String(active.id).split(':')
    const overParts = String(over.id).split(':')
    const dayIdx = Number(parts[1])
    const oldIdx = Number(parts[2])
    const newIdx = Number(overParts[2])

    onUpdateItinerary(reorderActivities(itinerary, dayIdx, oldIdx, newIdx))
  }

  // Editable summary in header
  function SummaryField() {
    if (editingId === 'summary') {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          autoFocus
          value={editingValue}
          rows={2}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitEdit('summary', editingValue)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelEdit() } }}
          className="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-1 text-sm leading-6 text-[#75624c] text-right outline-none ring-1 ring-[#5f7d59]/40 resize-none"
        />
      )
    }
    return (
      <span
        role="button" tabIndex={0}
        onClick={() => startEdit('summary', itinerary.summary)}
        onKeyDown={(e) => e.key === 'Enter' && startEdit('summary', itinerary.summary)}
        className="group/edit inline-flex cursor-text items-start gap-1"
        title="Click to edit"
      >
        <span>{itinerary.summary}</span>
        <span className="mt-0.5 shrink-0 opacity-0 text-[10px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
      </span>
    )
  }

  // Editable day theme
  function DayThemeField() {
    const id = `day:${safeActiveDay}:theme`
    if (editingId === id) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          autoFocus
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => commitEdit(id, editingValue)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(id, editingValue) }
          }}
          className="w-full rounded border border-[#bca98d] bg-[#fffdf8] px-2 py-0.5 text-2xl font-bold text-[#2f2419] outline-none ring-1 ring-[#5f7d59]/40"
        />
      )
    }
    return (
      <span
        role="button" tabIndex={0}
        onClick={() => startEdit(id, day?.theme ?? '')}
        onKeyDown={(e) => e.key === 'Enter' && startEdit(id, day?.theme ?? '')}
        className="group/edit inline-flex cursor-text items-baseline gap-1"
        title="Click to edit"
      >
        {day?.theme}
        <span className="opacity-0 text-[10px] text-[#a69682] transition group-hover/edit:opacity-60">✏</span>
      </span>
    )
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f4efe7] text-[#3e3021]">
      {/* Header */}
      <div className="border-b border-[#dfd4c5] bg-[#fbf7ef] px-6 py-4 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6f8a68]">Editing workspace</p>
            <h2 className="mt-1 truncate text-2xl font-bold text-[#2f2419]">{itinerary.trip.destination}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#75624c]">
              <span>{itinerary.trip.startDate} to {itinerary.trip.endDate}</span>
              <span className="h-1 w-1 rounded-full bg-[#b7a791]" />
              <span>{days} {days === 1 ? 'day' : 'days'}</span>
              <span className="h-1 w-1 rounded-full bg-[#b7a791]" />
              <span>{travelers} {travelers === 1 ? 'traveler' : 'travelers'}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-[#8a7965]">
              {itinerary.trip.accommodationLocation && (
                <span className="rounded-full border border-[#d8c9b5] bg-[#fffaf1] px-3 py-1">
                  Staying near {itinerary.trip.accommodationLocation}
                </span>
              )}
              <span className="rounded-full border border-[#d8c9b5] bg-[#fffaf1] px-3 py-1">
                Window {itinerary.trip.dailyStartTime ?? '09:00'} - {itinerary.trip.dailyEndTime ?? '21:00'}
              </span>
            </div>
          </div>

          <div className="flex max-w-xl flex-col items-end gap-3">
            <p className="max-w-lg text-right text-sm leading-6 text-[#75624c]">
              <SummaryField />
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {savedTripId && onOverview && (
                <button
                  type="button"
                  onClick={onOverview}
                  className="rounded-full border border-[#d1c0aa] bg-[#fffaf1] px-4 py-2 text-xs font-semibold text-[#5c4630] shadow-sm transition hover:border-[#bca98d] hover:bg-white"
                >
                  View overview
                </button>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="rounded-full bg-[#5f7d59] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#4f6b49] disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : savedTripId ? 'Save changes' : 'Save trip'}
              </button>
              <button
                type="button"
                onClick={() => downloadItineraryMarkdown(itinerary)}
                className="rounded-full border border-[#d1c0aa] bg-transparent px-4 py-2 text-xs font-semibold text-[#75624c] transition hover:bg-[#fffaf1]"
              >
                Export .md
              </button>
            </div>
            {(saveStatus || saveError) && (
              <p className={`text-xs font-medium ${saveError ? 'text-rose-600' : 'text-[#4f7b4d]'}`}>
                {saveError ?? saveStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 w-[58%] flex-col border-r border-[#dfd4c5]">
          {/* Day tabs */}
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-[#dfd4c5] bg-[#fbf7ef]/70 px-5 py-3">
            {itinerary.days.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  safeActiveDay === i
                    ? 'border-[#5f7d59] bg-[#5f7d59] text-white'
                    : 'border-[#d8c9b5] bg-[#fffaf1] text-[#75624c] hover:border-[#bca98d] hover:bg-white'
                }`}
              >
                Day {d.day}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {day && (
              <>
                {/* Day header card */}
                <div className="rounded-[28px] border border-[#dfd4c5] bg-[#fffaf1] p-5 shadow-[0_18px_40px_rgba(75,58,36,0.08)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Current day</p>
                      <h3 className="mt-2 text-2xl font-bold text-[#2f2419]">
                        <DayThemeField />
                      </h3>
                      <p className="mt-1 text-sm font-medium text-[#75624c]">
                        {day.date}{currentDayWindow ? ` - ${currentDayWindow}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#66523b]">
                      <span className="rounded-full bg-[#f0e4d4] px-3 py-1.5">{day.activities.length} stops</span>
                      <span className="rounded-full bg-[#e1eadb] px-3 py-1.5">{formatMinutes(dayTravelMinutes)} travel</span>
                    </div>
                  </div>
                </div>

                {/* Sortable activity list */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={activityIds} strategy={verticalListSortingStrategy}>
                    <div className="mt-5 space-y-3">
                      {day.activities.map((act, i) => (
                        <SortableActivityRow
                          key={`act:${safeActiveDay}:${i}`}
                          dragId={`act:${safeActiveDay}:${i}`}
                          act={act}
                          index={i}
                          actIdx={i}
                          totalActivities={day.activities.length}
                          onDelete={() => onUpdateItinerary?.(removeActivity(itinerary, safeActiveDay, i))}
                          onMoveToDay={(toDayIdx) => {
                            onUpdateItinerary?.(moveActivityToDay(itinerary, safeActiveDay, i, toDayIdx))
                          }}
                          {...commonCardProps}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {draggingActivity && (
                      <div className="rotate-1 rounded-[24px] border border-[#dfd4c5] bg-[#fffaf1] p-4 shadow-2xl opacity-95">
                        <p className="text-base font-bold text-[#2f2419]">{draggingActivity.title}</p>
                        <p className="mt-1 text-xs font-medium text-[#8a7965]">{draggingActivity.location}</p>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              </>
            )}
          </div>

          {/* Planning notes */}
          <div className="shrink-0 border-t border-[#dfd4c5] bg-[#fbf7ef] px-5 py-3">
            <div className="mb-2 flex items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Planning notes</p>
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
            {itinerary.tips.length > 0 && (
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {itinerary.tips.slice(0, 6).map((tip, i) => (
                  <li key={i} className="group/tip flex items-start gap-2 text-xs leading-5 text-[#75624c]">
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
                        role="button" tabIndex={0}
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
                        className="mt-0.5 flex-shrink-0 text-[#c4b09a] opacity-0 transition hover:text-rose-500 group-hover/tip:opacity-100"
                        title="Remove note"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Map sidebar */}
        <aside className="flex min-w-[360px] flex-1 flex-col gap-4 p-5">
          <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-[#dfd4c5] bg-[#fffaf1] p-4 shadow-[0_18px_40px_rgba(75,58,36,0.08)]">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Working map</p>
                <h3 className="mt-1 text-lg font-bold text-[#2f2419]">Day {day?.day ?? 1} route</h3>
              </div>
              <div className="rounded-2xl bg-[#f0e4d4] px-3 py-2 text-right text-xs font-semibold text-[#66523b]">
                <p>{mapLocations.length} pins</p>
                <p className="mt-0.5 text-[#8a7965]">{formatMinutes(dayTravelMinutes)} travel</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[#d1c0aa] bg-[#e9e1d4]">
              <MapView center={mapCenter} locations={mapLocations} activeDay={day?.day} />
            </div>
          </div>

          <div className="rounded-[24px] border border-[#dfd4c5] bg-[#fbf7ef] p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8a68]">Studio focus</p>
            <p className="mt-2 text-sm leading-6 text-[#66523b]">
              Drag the <span className="font-semibold">⠿</span> handle to reorder stops. Use <span className="font-semibold">→D</span> buttons to move a stop to another day. Click any text to edit it directly.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
