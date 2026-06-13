'use client'

import Link from 'next/link'
import { GoogleMap, OverlayView, useJsApiLoader } from '@react-google-maps/api'
import { type ChangeEvent, type CSSProperties, type FormEvent, type SyntheticEvent, useEffect, useMemo, useState } from 'react'

interface Props {
  userName: string
}

type TapeStyle = 'pin' | 'tape-left' | 'tape-right'

interface FootprintMemory {
  id: string
  place: string
  title: string
  memoryTime: string
  content: string
  emoji: string
  date: string
  lat: number
  lng: number
  color: string
  rotation: number
  tapeStyle: TapeStyle
  tripTitle?: string
  photoDataUrl?: string | null
}

interface DraftMemory {
  lat: number
  lng: number
  place: string
  title: string
  memoryTime: string
  content: string
  emoji: string
  photoDataUrl: string | null
}

interface Ripple {
  id: string
  lat: number
  lng: number
}

const STORAGE_KEY = 'meetu-footprint-memories-v1'
const DEFAULT_MAP_CENTER = { lat: 22.5, lng: 114.1 }
const DEFAULT_MAP_ZOOM = 3

const MEMORY_COLORS = ['#6F8A68', '#B46F4D', '#8E76A8', '#C49A4A', '#4F7C8A', '#B88496']
const TAPE_STYLES: TapeStyle[] = ['pin', 'tape-left', 'tape-right']
const EMOJI_CHOICES = ['📍', '✈️', '🌊', '⛰️', '🏙️', '🌸', '☕️', '🍜', '🎡', '🏛️', '🌅', '🧳', '🚃', '🗺️', '💛', '⭐️']
const GOOGLE_MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

const FOOTPRINT_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#ebe2cf' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6f5b43' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fbf6eb' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#cfbf9e' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#f3ecd9' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#dfebd5' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#78906b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#fff7e8' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#ddcfb2' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a765d' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#dccfb3' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#cfe1db' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6e918d' }] },
]

const FOOTPRINT_MAP_OPTIONS: google.maps.MapOptions = {
  clickableIcons: false,
  disableDefaultUI: false,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: true,
  gestureHandling: 'greedy',
  backgroundColor: '#f4ead8',
  styles: FOOTPRINT_MAP_STYLES,
}

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function seededRotation(seed: string, index: number) {
  return ((hashString(seed) + index * 13) % 15) - 7
}

function seededColor(seed: string, index: number) {
  return MEMORY_COLORS[(hashString(seed) + index) % MEMORY_COLORS.length]
}

function seededTape(seed: string, index: number) {
  return TAPE_STYLES[(hashString(seed) + index) % TAPE_STYLES.length]
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function toDatetimeLocal(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function dateKey(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function cleanLabel(value?: string | null) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

function safeParseMemories(raw: string | null) {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => (
        item &&
        typeof item.id === 'string' &&
        typeof item.lat === 'number' &&
        typeof item.lng === 'number'
      ))
      .map((item): FootprintMemory => {
        const legacyCaption = typeof item.caption === 'string' ? item.caption : ''
        const title = cleanLabel(item.title) || cleanLabel(item.place) || cleanLabel(legacyCaption) || 'Untitled memory'
        const content = cleanLabel(item.content) || legacyCaption || 'A saved travel memory.'
        const date = typeof item.date === 'string' ? item.date : new Date().toISOString()

        return {
          id: item.id,
          place: cleanLabel(item.place) || 'Pinned place',
          title,
          memoryTime: typeof item.memoryTime === 'string' ? item.memoryTime : date,
          content,
          emoji: typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim() : '📍',
          date,
          lat: item.lat,
          lng: item.lng,
          color: typeof item.color === 'string' ? item.color : '#6F8A68',
          rotation: typeof item.rotation === 'number' ? item.rotation : 0,
          tapeStyle: TAPE_STYLES.includes(item.tapeStyle) ? item.tapeStyle : 'pin',
          tripTitle: typeof item.tripTitle === 'string' ? item.tripTitle : 'My Footprints',
          photoDataUrl: typeof item.photoDataUrl === 'string' ? item.photoDataUrl : null,
        }
      })
  } catch {
    return []
  }
}

function fallbackContent() {
  const options = [
    'The air felt soft here.',
    'A small moment worth keeping.',
    'I want to remember how this place made me feel.',
    'A quiet coordinate with a bright little memory.',
  ]
  return options[Math.floor(Math.random() * options.length)]
}

function formatMemoryTime(memory: Pick<FootprintMemory, 'memoryTime' | 'date'>) {
  return formatDate(memory.memoryTime || memory.date)
}

function stopMapEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

function normalizeEmoji(value: string) {
  return value.trim().slice(0, 4) || '📍'
}

function MiniPolaroid({
  memory,
  isDeveloping = false,
  compact = false,
  detail = false,
}: {
  memory: FootprintMemory
  isDeveloping?: boolean
  compact?: boolean
  detail?: boolean
}) {
  const style = {
    '--rotate': `${memory.rotation}deg`,
    '--accent': memory.color,
  } as CSSProperties

  return (
    <article
      className={[
        'footprint-polaroid',
        compact ? 'footprint-polaroid--compact' : '',
        detail ? 'footprint-polaroid--detail' : '',
        isDeveloping ? 'footprint-polaroid--developing' : '',
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <span className={`footprint-fastener footprint-fastener--${memory.tapeStyle}`} />
      <div className="footprint-photo">
        {memory.photoDataUrl ? (
          <div className="footprint-photo__image" style={{ backgroundImage: `url(${memory.photoDataUrl})` }} />
        ) : (
          <div className="footprint-photo__placeholder">
            <span>{memory.place}</span>
          </div>
        )}
      </div>
      <div className="footprint-polaroid__caption">
        <strong>{memory.title}</strong>
        <span>{formatMemoryTime(memory)}</span>
        <p>{memory.content}</p>
      </div>
    </article>
  )
}

export function FootprintsExperience({ userName }: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAP_KEY,
  })
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [manualMemories, setManualMemories] = useState<FootprintMemory[]>(() => (
    typeof window === 'undefined'
      ? []
      : safeParseMemories(window.localStorage.getItem(STORAGE_KEY))
  ))
  const [draft, setDraft] = useState<DraftMemory | null>(null)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [developingId, setDevelopingId] = useState<string | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null)
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeSearchStatus, setPlaceSearchStatus] = useState<string | null>(null)
  const [isSearchingPlace, setIsSearchingPlace] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(manualMemories))
  }, [manualMemories])

  const allMemories = useMemo(() => (
    [...manualMemories].sort((a, b) => dateKey(a.date) - dateKey(b.date))
  ), [manualMemories])

  const uniquePlaces = useMemo(() => new Set(allMemories.map((memory) => memory.place.toLowerCase())).size, [allMemories])
  const activeMemory = useMemo(() => (
    allMemories.find((memory) => memory.id === activeMemoryId) ?? null
  ), [activeMemoryId, allMemories])

  function addRipple(lat: number, lng: number) {
    const id = `ripple-${Date.now()}`
    setRipples((prev) => [...prev, { id, lat, lng }])
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id))
    }, 1400)
  }

  function openDraftAt(lat: number, lng: number, place: string) {
    addRipple(lat, lng)
    setActiveMemoryId(null)
    setEditingMemoryId(null)
    setGalleryOpen(false)

    setDraft({
      lat,
      lng,
      place,
      title: '',
      memoryTime: toDatetimeLocal(new Date()),
      content: '',
      emoji: '📍',
      photoDataUrl: null,
    })

    map?.panTo({ lat, lng })
    const nextZoom = Math.max(map?.getZoom() ?? DEFAULT_MAP_ZOOM, 15)
    map?.setZoom(nextZoom)
  }

  function closeDraft() {
    setDraft(null)
    setEditingMemoryId(null)
  }

  function editMemory(memory: FootprintMemory) {
    setActiveMemoryId(null)
    setGalleryOpen(false)
    setEditingMemoryId(memory.id)
    setDraft({
      lat: memory.lat,
      lng: memory.lng,
      place: memory.place,
      title: memory.title,
      memoryTime: memory.memoryTime,
      content: memory.content,
      emoji: memory.emoji,
      photoDataUrl: memory.photoDataUrl ?? null,
    })
    map?.panTo({ lat: memory.lat, lng: memory.lng })
    map?.setZoom(Math.max(map?.getZoom() ?? DEFAULT_MAP_ZOOM, 15))
  }

  async function handlePlaceSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const query = cleanLabel(placeQuery)
    if (!query) {
      setPlaceSearchStatus('Type a place name first.')
      return
    }

    if (!isLoaded || !GOOGLE_MAP_KEY) {
      setPlaceSearchStatus('Google Maps is not ready yet.')
      return
    }

    setIsSearchingPlace(true)
    setPlaceSearchStatus(null)

    try {
      const geocoder = new google.maps.Geocoder()
      const response = await geocoder.geocode({
        address: query,
        bounds: map?.getBounds() ?? undefined,
      })
      const result = response.results[0]
      const location = result?.geometry.location

      if (!result || !location) {
        setPlaceSearchStatus('I could not find that place. Try a more specific name.')
        return
      }

      const lat = location.lat()
      const lng = location.lng()
      openDraftAt(lat, lng, result.formatted_address || query)
      setIsAddModalOpen(false)
      setPlaceQuery('')
    } catch {
      setPlaceSearchStatus('I could not find that place. Try a nearby landmark or city name.')
    } finally {
      setIsSearchingPlace(false)
    }
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setDraft((prev) => prev ? { ...prev, photoDataUrl: String(reader.result) } : prev)
    }
    reader.readAsDataURL(file)
  }

  function sealDraft() {
    if (!draft) return

    if (editingMemoryId) {
      const updatedId = editingMemoryId
      setManualMemories((prev) => prev.map((memory) => (
        memory.id === updatedId
          ? {
              ...memory,
              place: cleanLabel(draft.place) || memory.place,
              title: cleanLabel(draft.title) || cleanLabel(draft.place) || memory.title,
              memoryTime: draft.memoryTime || memory.memoryTime,
              content: cleanLabel(draft.content) || memory.content,
              emoji: normalizeEmoji(draft.emoji),
              photoDataUrl: draft.photoDataUrl,
            }
          : memory
      )))
      setActiveMemoryId(updatedId)
      closeDraft()
      return
    }

    const id = `manual-${Date.now()}`
    const seed = `${draft.lat}:${draft.lng}:${draft.title}:${draft.content}`
    const now = new Date().toISOString()
    const memory: FootprintMemory = {
      id,
      place: cleanLabel(draft.place) || 'Pinned memory',
      title: cleanLabel(draft.title) || cleanLabel(draft.place) || 'Untitled memory',
      memoryTime: draft.memoryTime || now,
      content: cleanLabel(draft.content) || fallbackContent(),
      emoji: normalizeEmoji(draft.emoji),
      date: now,
      lat: draft.lat,
      lng: draft.lng,
      color: seededColor(seed, manualMemories.length),
      rotation: seededRotation(seed, manualMemories.length),
      tapeStyle: seededTape(seed, manualMemories.length),
      photoDataUrl: draft.photoDataUrl,
      tripTitle: 'My Footprints',
    }

    setManualMemories((prev) => [memory, ...prev])
    setDevelopingId(id)
    setActiveMemoryId(id)
    setDraft(null)
    window.setTimeout(() => {
      setDevelopingId((current) => current === id ? null : current)
    }, 2600)
  }

  function deleteMemory(memoryId: string) {
    const memory = manualMemories.find((item) => item.id === memoryId)
    const shouldDelete = window.confirm(`Delete this memory${memory?.place ? ` from ${memory.place}` : ''}?`)
    if (!shouldDelete) return

    setManualMemories((prev) => prev.filter((item) => item.id !== memoryId))
    setActiveMemoryId((current) => current === memoryId ? null : current)
    setDevelopingId((current) => current === memoryId ? null : current)
  }

  return (
    <main className="footprints-page">
      <header className="footprints-topbar" data-no-map-drop>
        <Link href="/dashboard" className="footprints-brand">
          <span />
          MeetU
        </Link>
        <div className="footprints-topbar__center">
          <p>{userName}&apos;s travel scrapbook</p>
          <h1>My Footprints</h1>
        </div>
        <div className="footprints-topbar__actions">
          <Link href="/dashboard" className="footprints-button footprints-button--quiet">Dashboard</Link>
        </div>
      </header>

      <section className="footprints-stage">
        <div className="footprints-intro" data-no-map-drop>
          <span className="footprints-stamp">Memory map</span>
          <h2>Pin the places you remember.</h2>
          <p>
            Search a real place, seal a photo, and let the memory live on the exact map point.
          </p>
          <div className="footprints-stats">
            <span><strong>{allMemories.length}</strong> memories</span>
            <span><strong>{uniquePlaces}</strong> places</span>
            <span><strong>{manualMemories.length}</strong> sealed by you</span>
          </div>
          {!GOOGLE_MAP_KEY && <p className="footprints-muted">Add NEXT_PUBLIC_GOOGLE_MAPS_KEY to use the real map.</p>}
          {loadError && <p className="footprints-muted">Google Maps could not load. Check your Maps key configuration.</p>}
        </div>

        <div className="footprints-map-board">
          {isLoaded ? (
            <GoogleMap
              mapContainerClassName="footprints-google-map"
              center={DEFAULT_MAP_CENTER}
              zoom={DEFAULT_MAP_ZOOM}
              options={FOOTPRINT_MAP_OPTIONS}
              onLoad={(loadedMap) => {
                setMap(loadedMap)
              }}
              onUnmount={() => setMap(null)}
              onClick={() => {
                setActiveMemoryId(null)
                closeDraft()
              }}
            >
              {ripples.map((ripple) => (
                <OverlayView
                  key={ripple.id}
                  position={{ lat: ripple.lat, lng: ripple.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <span className="footprint-ripple" />
                </OverlayView>
              ))}

              {allMemories.map((memory) => (
                <OverlayView
                  key={memory.id}
                  position={{ lat: memory.lat, lng: memory.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <button
                    type="button"
                    className="footprints-memory-marker is-pin"
                    data-no-map-drop
                    aria-label={`${memory.title} at ${memory.place}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      closeDraft()
                      setActiveMemoryId((current) => current === memory.id ? null : memory.id)
                    }}
                  >
                    <span className="footprint-map-pin" style={{ '--accent': memory.color } as CSSProperties}>
                      <span>{memory.emoji}</span>
                    </span>
                  </button>
                </OverlayView>
              ))}

              {activeMemory && (
                <OverlayView
                  position={{ lat: activeMemory.lat, lng: activeMemory.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div
                    className="footprints-memory-popover"
                    data-no-map-drop
                    onClick={stopMapEvent}
                    onMouseDown={stopMapEvent}
                    onPointerDown={stopMapEvent}
                    onTouchStart={stopMapEvent}
                  >
                    <button
                      type="button"
                      className="footprints-close footprints-memory-popover__close"
                      onClick={() => setActiveMemoryId(null)}
                      aria-label="Close memory"
                    >
                      ×
                    </button>
                    <MiniPolaroid memory={activeMemory} isDeveloping={developingId === activeMemory.id} detail />
                    <div className="footprints-memory-popover__meta">
                      <strong>{activeMemory.place}</strong>
                      <span>{activeMemory.lat.toFixed(4)}, {activeMemory.lng.toFixed(4)}</span>
                    </div>
                    <button
                      type="button"
                      className="footprints-edit-button"
                      onClick={() => editMemory(activeMemory)}
                    >
                      Edit memory
                    </button>
                    <button
                      type="button"
                      className="footprints-danger-button"
                      onClick={() => deleteMemory(activeMemory.id)}
                    >
                      Delete memory
                    </button>
                  </div>
                </OverlayView>
              )}

              {draft && (
                <OverlayView
                  position={{ lat: draft.lat, lng: draft.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div
                    className="footprints-draft"
                    data-no-map-drop
                    onClick={stopMapEvent}
                    onMouseDown={stopMapEvent}
                    onPointerDown={stopMapEvent}
                    onTouchStart={stopMapEvent}
                  >
                    <div className="footprints-draft-form">
                      <input
                        className="footprints-place-input"
                        value={draft.place}
                        onChange={(event) => setDraft((prev) => prev ? { ...prev, place: event.target.value } : prev)}
                        placeholder="Place name"
                        maxLength={60}
                      />
                      <input
                        className="footprints-place-input"
                        value={draft.title}
                        onChange={(event) => setDraft((prev) => prev ? { ...prev, title: event.target.value } : prev)}
                        placeholder="Title"
                        maxLength={72}
                      />
                      <input
                        className="footprints-place-input"
                        type="datetime-local"
                        value={draft.memoryTime}
                        onChange={(event) => setDraft((prev) => prev ? { ...prev, memoryTime: event.target.value } : prev)}
                      />
                      <div className="footprints-emoji-picker" aria-label="Choose map emoji">
                        <input
                          className="footprints-emoji-input"
                          value={draft.emoji}
                          onChange={(event) => setDraft((prev) => prev ? { ...prev, emoji: normalizeEmoji(event.target.value) } : prev)}
                          aria-label="Custom emoji"
                        />
                        <div className="footprints-emoji-grid">
                          {EMOJI_CHOICES.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={draft.emoji === emoji ? 'is-selected' : ''}
                              onClick={() => setDraft((prev) => prev ? { ...prev, emoji } : prev)}
                              aria-label={`Use ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={draft.content}
                        onChange={(event) => setDraft((prev) => prev ? { ...prev, content: event.target.value } : prev)}
                        placeholder="What do you want to remember here?"
                        maxLength={180}
                      />
                      <div className="footprints-draft-form__actions">
                        <label className="footprints-button footprints-button--quiet">
                          Upload photo
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                        <button type="button" className="footprints-button" onClick={sealDraft}>
                          {editingMemoryId ? 'Save' : 'Seal'}
                        </button>
                        <button type="button" className="footprints-close" onClick={closeDraft} aria-label="Close draft">
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="footprint-polaroid footprint-polaroid--draft">
                      <span className="footprint-fastener footprint-fastener--pin" />
                      <div className="footprint-photo">
                        {draft.photoDataUrl ? (
                          <div className="footprint-photo__image footprint-photo__image--preview" style={{ backgroundImage: `url(${draft.photoDataUrl})` }} />
                        ) : (
                          <div className="footprint-photo__blank">
                            <span>photo</span>
                          </div>
                        )}
                      </div>
                      <div className="footprint-polaroid__caption">
                        <strong>{cleanLabel(draft.title) || 'Memory title'}</strong>
                        <span>{formatDate(draft.memoryTime || new Date().toISOString())}</span>
                        <p>{cleanLabel(draft.content) || 'A quiet moment from this place.'}</p>
                      </div>
                    </div>
                  </div>
                </OverlayView>
              )}
            </GoogleMap>
          ) : (
            <div className="footprints-map-loading">
              <span className="footprints-stamp">Loading map</span>
              <p>Google Maps is preparing your scrapbook board.</p>
            </div>
          )}

          <div className="footprints-map-vignette" />
          <div className="footprints-map-paper-grain" />
        </div>

        <button
          type="button"
          className="footprints-add-memory-fab"
          onClick={() => {
            setIsAddModalOpen(true)
            setPlaceSearchStatus(null)
          }}
          data-no-map-drop
        >
          <span>+</span>
          Add memory
        </button>

        <aside className={`footprints-gallery ${galleryOpen ? 'is-open' : ''}`} data-no-map-drop>
          <button
            type="button"
            className="footprints-gallery__header"
            onClick={() => setGalleryOpen((open) => !open)}
            aria-expanded={galleryOpen}
          >
            <div>
              <p>Memory curtain</p>
              <h2>Time string</h2>
            </div>
            <span className="footprints-curtain-pull">{galleryOpen ? 'Close' : `${allMemories.length} memories`}</span>
          </button>
          <div className="footprints-clothesline">
            {allMemories.length === 0 ? (
              <p className="footprints-empty">Add a place to seal your first memory.</p>
            ) : (
              allMemories.map((memory, index) => (
                <div
                  key={`line-${memory.id}`}
                  className={`footprints-line-item ${index % 2 === 0 ? 'is-left' : 'is-right'}`}
                  style={{
                    '--line-delay': `${index * 45}ms`,
                    '--rotate': `${memory.rotation / 2}deg`,
                  } as CSSProperties}
                >
                  <span className="footprints-clip" />
                  <MiniPolaroid memory={memory} compact />
                  <button
                    type="button"
                    className="footprints-line-delete"
                    onClick={() => deleteMemory(memory.id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      {isAddModalOpen && (
        <div className="footprints-search-backdrop" data-no-map-drop>
          <form
            className="footprints-search-modal"
            onSubmit={handlePlaceSearch}
            onClick={stopMapEvent}
            onMouseDown={stopMapEvent}
            onPointerDown={stopMapEvent}
            onTouchStart={stopMapEvent}
          >
            <div className="footprints-search-modal__header">
              <div>
                <p>Plant a memory</p>
                <h2>Where did it happen?</h2>
              </div>
              <button
                type="button"
                className="footprints-close"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close add memory"
              >
                ×
              </button>
            </div>
            <input
              className="footprints-search-input"
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="Sydney Opera House, Shibuya Crossing..."
              autoFocus
            />
            {placeSearchStatus && <p className="footprints-search-status">{placeSearchStatus}</p>}
            <div className="footprints-search-actions">
              <button
                type="button"
                className="footprints-button footprints-button--quiet"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="footprints-button" disabled={isSearchingPlace}>
                {isSearchingPlace ? 'Finding...' : 'Find place'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
