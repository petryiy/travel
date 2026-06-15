'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Line, ScrollControls, Text, useScroll } from '@react-three/drei'
import { easing } from 'maath'
import { useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  type BufferAttribute,
  type Group,
  type Mesh,
  type PerspectiveCamera,
  Vector3,
} from 'three'

interface Props {
  userName: string
}

interface StoryMemory {
  id: string
  place: string
  title: string
  memoryTime: string
  content: string
  emoji: string
  lat: number
  lng: number
  color: string
  rotation: number
  photoDataUrl?: string | null
}

const STORAGE_KEY = 'meetu-footprint-memories-v1'
const BOOK_WIDTH = 5.9
const BOOK_HEIGHT = 3.65
const GLOBE_RADIUS = 1.02
const MAP_WIDTH = 4.85
const MAP_HEIGHT = 2.75

const PAPER_COLORS = {
  ink: '#312216',
  mutedInk: '#715d43',
  paper: '#f2e4c8',
  paperDark: '#ddc7a3',
  land: '#d7d6a5',
  landShade: '#b7c19a',
  waterLine: 'rgba(88, 114, 104, 0.2)',
}

const SAMPLE_MEMORIES: StoryMemory[] = [
  {
    id: 'sample-sydney',
    place: 'Sydney Opera House',
    title: 'Harbour light',
    memoryTime: '2026-06-05T16:00',
    content: 'The water turned gold for a few quiet minutes.',
    emoji: '🌅',
    lat: -33.8568,
    lng: 151.2153,
    color: '#6F8A68',
    rotation: -4,
  },
  {
    id: 'sample-bondi',
    place: 'Bondi Beach',
    title: 'Soft blue afternoon',
    memoryTime: '2026-06-06T14:30',
    content: 'A small pause with salt in the air.',
    emoji: '🌊',
    lat: -33.8915,
    lng: 151.2767,
    color: '#B46F4D',
    rotation: 5,
  },
  {
    id: 'sample-garden',
    place: 'Royal Botanic Garden Sydney',
    title: 'Green shade',
    memoryTime: '2026-06-07T13:20',
    content: 'A slow walk that made the city feel gentle.',
    emoji: '🌿',
    lat: -33.8642,
    lng: 151.2166,
    color: '#8E76A8',
    rotation: 2,
  },
  {
    id: 'sample-manly',
    place: 'Manly',
    title: 'Ferry wind',
    memoryTime: '2026-06-07T17:15',
    content: 'The skyline moved away like a postcard.',
    emoji: '⛴️',
    lat: -33.7969,
    lng: 151.2855,
    color: '#C49A4A',
    rotation: -2,
  },
]

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max)
}

function phase(offset: number, start: number, end: number) {
  const value = clamp((offset - start) / (end - start))
  return value * value * (3 - 2 * value)
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

function cleanLabel(value?: string | null) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

function dateKey(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Undated'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function uniquePlaces(memories: StoryMemory[]) {
  return Array.from(new Set(memories.map((memory) => memory.place.split(',')[0].trim()).filter(Boolean)))
}

function parseMemories(raw: string | null): StoryMemory[] {
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
      .map((item): StoryMemory => {
        const fallbackDate = typeof item.date === 'string' ? item.date : new Date().toISOString()
        const place = cleanLabel(item.place) || 'Pinned place'

        return {
          id: item.id,
          place,
          title: cleanLabel(item.title) || place,
          memoryTime: typeof item.memoryTime === 'string' ? item.memoryTime : fallbackDate,
          content: cleanLabel(item.content) || cleanLabel(item.caption) || 'A saved travel memory.',
          emoji: cleanLabel(item.emoji) || '📍',
          lat: item.lat,
          lng: item.lng,
          color: typeof item.color === 'string' ? item.color : '#6F8A68',
          rotation: typeof item.rotation === 'number' ? item.rotation : 0,
          photoDataUrl: typeof item.photoDataUrl === 'string' ? item.photoDataUrl : null,
        }
      })
      .sort((a, b) => dateKey(a.memoryTime) - dateKey(b.memoryTime))
  } catch {
    return []
  }
}

function useClientMemories() {
  const [memories] = useState<StoryMemory[]>(() => (
    typeof window === 'undefined'
      ? []
      : parseMemories(window.localStorage.getItem(STORAGE_KEY))
  ))

  return memories
}

function latLngToSphere(lat: number, lng: number, radius = GLOBE_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)

  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function rotateY(point: Vector3, radians: number) {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return new Vector3(
    point.x * cos + point.z * sin,
    point.y,
    -point.x * sin + point.z * cos,
  )
}

function projectedPoint(lng: number, lat: number, width: number, height: number) {
  return [
    ((lng + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ] as const
}

function drawContinent(ctx: CanvasRenderingContext2D, width: number, height: number, points: Array<[number, number]>) {
  if (!points.length) return

  ctx.beginPath()
  points.forEach(([lng, lat], index) => {
    const [x, y] = projectedPoint(lng, lat, width, height)
    if (index === 0) {
      ctx.moveTo(x, y)
      return
    }

    ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawCompassRose(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = 'rgba(70, 48, 27, 0.34)'
  ctx.fillStyle = 'rgba(111, 138, 104, 0.24)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.18, -size * 0.18)
  ctx.lineTo(size, 0)
  ctx.lineTo(size * 0.18, size * 0.18)
  ctx.lineTo(0, size)
  ctx.lineTo(-size * 0.18, size * 0.18)
  ctx.lineTo(-size, 0)
  ctx.lineTo(-size * 0.18, -size * 0.18)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#6f8a68'
  ctx.font = `bold ${Math.max(14, size * 0.34)}px Georgia`
  ctx.textAlign = 'center'
  ctx.fillText('N', 0, -size - 8)
  ctx.restore()
}

function drawWorldMapTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: { label?: string; route?: StoryMemory[]; lowContrast?: boolean } = {},
) {
  const { label, route = [], lowContrast = false } = options
  const opacity = lowContrast ? 0.56 : 0.86
  const continents: Array<Array<[number, number]>> = [
    [[-168, 72], [-148, 66], [-136, 58], [-126, 50], [-124, 41], [-117, 32], [-105, 26], [-99, 18], [-88, 20], [-81, 26], [-76, 36], [-70, 45], [-58, 48], [-52, 57], [-72, 64], [-96, 69], [-124, 72]],
    [[-99, 22], [-90, 18], [-82, 13], [-75, 8], [-79, 4], [-88, 9], [-96, 14]],
    [[-81, 12], [-71, 8], [-59, -2], [-48, -15], [-44, -28], [-54, -42], [-67, -55], [-75, -36], [-80, -13]],
    [[-11, 36], [-3, 50], [12, 58], [29, 54], [39, 45], [28, 38], [11, 36]],
    [[-17, 32], [4, 36], [24, 31], [37, 16], [48, 4], [39, -19], [29, -34], [14, -35], [-4, -22], [-13, 1], [-17, 20]],
    [[32, 60], [60, 59], [88, 55], [118, 52], [148, 47], [168, 57], [164, 34], [142, 28], [119, 22], [100, 8], [82, 20], [64, 24], [50, 12], [38, 25], [30, 43]],
    [[67, 24], [88, 22], [80, 7], [72, 16]],
    [[96, 15], [111, 7], [119, -5], [104, -7]],
    [[112, -13], [154, -15], [151, -32], [136, -41], [116, -35]],
    [[-52, 72], [-24, 69], [-35, 60], [-57, 62]],
    [[-170, -66], [-120, -70], [-60, -68], [0, -71], [70, -68], [145, -70], [178, -65]],
  ]

  ctx.save()
  ctx.strokeStyle = lowContrast ? 'rgba(104, 88, 62, 0.08)' : 'rgba(104, 88, 62, 0.14)'
  ctx.lineWidth = 1.2
  for (let lng = -120; lng <= 120; lng += 60) {
    const [x] = projectedPoint(lng, 0, width, height)
    ctx.beginPath()
    ctx.moveTo(x, 26)
    ctx.bezierCurveTo(x - 16, height * 0.35, x + 16, height * 0.65, x, height - 26)
    ctx.stroke()
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = projectedPoint(0, lat, width, height)
    ctx.beginPath()
    ctx.moveTo(34, y)
    ctx.bezierCurveTo(width * 0.3, y + 8, width * 0.7, y - 8, width - 34, y)
    ctx.stroke()
  }

  ctx.fillStyle = lowContrast ? 'rgba(172, 180, 134, 0.18)' : `rgba(172, 180, 134, ${opacity * 0.72})`
  ctx.strokeStyle = lowContrast ? 'rgba(105, 126, 82, 0.12)' : 'rgba(105, 126, 82, 0.3)'
  ctx.lineWidth = lowContrast ? 1.6 : 2.6
  continents.forEach((continent) => drawContinent(ctx, width, height, continent))

  if (!lowContrast) {
    const mapLabels: Array<[string, number, number]> = [
      ['AMERICA', -102, 44],
      ['EUROPE', 15, 49],
      ['AFRICA', 17, 4],
      ['ASIA', 92, 42],
      ['AUSTRALIA', 134, -27],
    ]

    ctx.fillStyle = 'rgba(62, 47, 31, 0.28)'
    ctx.font = `${Math.max(12, width * 0.014)}px sans-serif`
    ctx.textAlign = 'center'
    mapLabels.forEach(([text, lng, lat]) => {
      const [x, y] = projectedPoint(lng, lat, width, height)
      ctx.fillText(text, x, y)
    })
  }

  ctx.strokeStyle = lowContrast ? 'rgba(103, 86, 61, 0.1)' : 'rgba(103, 86, 61, 0.18)'
  ctx.lineWidth = lowContrast ? 0.9 : 1.15
  for (let i = 0; i < 18; i += 1) {
    const x = width * (0.08 + Math.random() * 0.84)
    const y = height * (0.16 + Math.random() * 0.7)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + 18, y - 12, x + 34, y + 10, x + 54, y - 2)
    ctx.stroke()
  }

  if (route.length > 1) {
    ctx.strokeStyle = 'rgba(132, 88, 59, 0.62)'
    ctx.lineWidth = lowContrast ? 3 : 4
    ctx.setLineDash([12, 12])
    ctx.lineCap = 'round'
    ctx.beginPath()
    route.forEach((memory, index) => {
      const [x, y] = projectedPoint(memory.lng, memory.lat, width, height)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }

  route.forEach((memory) => {
    const [x, y] = projectedPoint(memory.lng, memory.lat, width, height)
    ctx.fillStyle = memory.color
    ctx.beginPath()
    ctx.arc(x, y, lowContrast ? 4 : 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
  })

  if (label) {
    ctx.fillStyle = PAPER_COLORS.ink
    ctx.font = 'bold 40px Georgia'
    ctx.fillText(label, 48, 72)
  }
  ctx.restore()
}

function makePosterTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 960
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#fff6e7'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let y = 74; y < canvas.height - 52; y += 32) {
    ctx.strokeStyle = 'rgba(112, 82, 50, 0.055)'
    ctx.beginPath()
    ctx.moveTo(50, y)
    ctx.lineTo(canvas.width - 50, y + Math.sin(y * 0.03) * 2)
    ctx.stroke()
  }

  for (let i = 0; i < 5200; i += 1) {
    ctx.fillStyle = `rgba(88, 58, 28, ${Math.random() * 0.045})`
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1.15, 1.15)
  }

  ctx.strokeStyle = 'rgba(108, 78, 43, 0.18)'
  ctx.lineWidth = 4
  ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68)

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function makeMapTexture(memories: StoryMemory[]) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#efe2c8')
  gradient.addColorStop(1, '#f7edda')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let y = 0; y < canvas.height; y += 24) {
    ctx.strokeStyle = 'rgba(108, 78, 43, 0.055)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y + Math.sin(y * 0.08) * 3)
    ctx.stroke()
  }

  drawWorldMapTexture(ctx, canvas.width, canvas.height, { route: memories })
  drawCompassRose(ctx, canvas.width - 108, canvas.height - 98, 34)

  ctx.strokeStyle = 'rgba(132, 88, 59, 0.34)'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 12])
  ctx.beginPath()
  ctx.moveTo(canvas.width * 0.16, canvas.height * 0.78)
  ctx.bezierCurveTo(canvas.width * 0.34, canvas.height * 0.65, canvas.width * 0.5, canvas.height * 0.9, canvas.width * 0.74, canvas.height * 0.72)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#312216'
  ctx.font = 'bold 28px Georgia'
  ctx.fillText('Footprints route atlas', 54, 72)
  ctx.font = '18px sans-serif'
  ctx.fillStyle = '#806a4d'
  ctx.fillText('a paper map of saved memories', 56, 100)
  ctx.strokeStyle = 'rgba(107, 81, 49, 0.28)'
  ctx.lineWidth = 6
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56)

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function makeGlobeTexture(memories: StoryMemory[]) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#efe2c8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = `rgba(86, 61, 35, ${Math.random() * 0.055})`
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1.1, 1.1)
  }

  drawWorldMapTexture(ctx, canvas.width, canvas.height, { route: memories })

  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.height * 0.2,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.62,
  )
  vignette.addColorStop(0, 'rgba(255, 250, 238, 0.02)')
  vignette.addColorStop(1, 'rgba(93, 65, 37, 0.16)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function makePhotoTexture(memory: StoryMemory, index: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const drawCaption = () => {
    ctx.fillStyle = '#312216'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '92px serif'
    if (!memory.photoDataUrl) ctx.fillText(memory.emoji, 256, 240)
    ctx.textAlign = 'left'
    ctx.font = 'bold 31px Georgia'
    ctx.fillText(memory.title.slice(0, 21), 52, 520)
    ctx.font = '22px sans-serif'
    ctx.fillStyle = '#806a4d'
    ctx.fillText(memory.place.slice(0, 31), 52, 562)
  }

  const gradients = [
    ['#d9e7d0', '#f7dfb5'],
    ['#c9e0dc', '#f2c8aa'],
    ['#ddd3e9', '#f4e6c7'],
    ['#e9d4bf', '#cfdcbf'],
  ]
  const [from, to] = gradients[index % gradients.length]
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)

  ctx.fillStyle = '#fffaf0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = gradient
  ctx.fillRect(46, 46, 420, 410)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.26)'
  ctx.beginPath()
  ctx.arc(166, 138, 82, 0, Math.PI * 2)
  ctx.fill()
  drawCaption()

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true

  if (memory.photoDataUrl) {
    const image = new Image()
    image.onload = () => {
      ctx.fillStyle = '#fffaf0'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const sourceRatio = image.width / image.height
      const targetRatio = 420 / 410
      let sx = 0
      let sy = 0
      let sw = image.width
      let sh = image.height
      if (sourceRatio > targetRatio) {
        sw = image.height * targetRatio
        sx = (image.width - sw) / 2
      } else {
        sh = image.width / targetRatio
        sy = (image.height - sh) / 2
      }
      ctx.drawImage(image, sx, sy, sw, sh, 46, 46, 420, 410)
      ctx.fillStyle = 'rgba(255, 248, 230, 0.16)'
      ctx.fillRect(46, 46, 420, 410)
      drawCaption()
      texture.needsUpdate = true
    }
    image.src = memory.photoDataUrl
  }

  return texture
}

function makeEmojiTexture(emoji: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(255, 250, 240, 0.94)'
  ctx.beginPath()
  ctx.arc(128, 128, 104, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(91, 66, 36, 0.18)'
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '104px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  ctx.fillText(emoji, 128, 132)

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function setGroupVisible(group: Group | Mesh | null, visible: boolean) {
  if (group) group.visible = visible
}

function Desktop() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0, -0.42]}>
        <planeGeometry args={[12, 7]} />
        <meshStandardMaterial color="#eadac0" roughness={0.96} />
      </mesh>
      <mesh position={[-3.8, 2.05, -0.38]} rotation={[0, 0, -0.12]}>
        <planeGeometry args={[1.1, 0.25]} />
        <meshStandardMaterial color="#f0c979" roughness={0.9} transparent opacity={0.72} />
      </mesh>
      <mesh position={[3.65, 1.95, -0.38]} rotation={[0, 0, 0.12]}>
        <planeGeometry args={[1.05, 0.25]} />
        <meshStandardMaterial color="#f0c979" roughness={0.9} transparent opacity={0.62} />
      </mesh>
    </group>
  )
}

function JournalBook() {
  const scroll = useScroll()
  const bookRef = useRef<Group>(null)
  const coverRef = useRef<Group>(null)

  useFrame((_, delta) => {
    const offset = scroll.offset
    const open = phase(offset, 0.02, 0.18)
    const leave = phase(offset, 0.2, 0.32)

    if (bookRef.current) {
      bookRef.current.visible = offset < 0.38
      easing.damp3(bookRef.current.position, [0, mix(-0.08, -0.22, leave), mix(0.02, -0.14, leave)], 0.18, delta)
      easing.damp3(bookRef.current.scale, [mix(1, 0.86, leave), mix(1, 0.86, leave), 1], 0.18, delta)
      easing.dampE(bookRef.current.rotation, [-0.035, 0, mix(-0.015, -0.05, leave)], 0.2, delta)
    }

    if (coverRef.current) {
      easing.dampE(coverRef.current.rotation, [0, -open * Math.PI * 0.86, 0], 0.14, delta)
    }
  })

  return (
    <group ref={bookRef} position={[0, -0.08, 0.02]} rotation={[-0.035, 0, -0.015]}>
      <mesh castShadow receiveShadow position={[0, 0, -0.06]}>
        <boxGeometry args={[BOOK_WIDTH + 0.2, BOOK_HEIGHT + 0.18, 0.12]} />
        <meshStandardMaterial color="#c9a06c" roughness={0.85} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.08, 0, 0.01]}>
        <boxGeometry args={[BOOK_WIDTH - 0.22, BOOK_HEIGHT - 0.22, 0.07]} />
        <meshStandardMaterial color="#fff8ed" roughness={0.92} />
      </mesh>
      <Line points={[[-0.02, -1.68, 0.06], [0.02, 1.68, 0.06]]} color="#d2bea0" lineWidth={2} transparent opacity={0.7} />
      <group ref={coverRef} position={[-BOOK_WIDTH / 2, 0, 0.12]}>
        <mesh castShadow receiveShadow position={[BOOK_WIDTH / 2, 0, 0]}>
          <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, 0.11]} />
          <meshStandardMaterial color="#6f8a68" roughness={0.86} />
        </mesh>
        <mesh position={[BOOK_WIDTH / 2, 0.55, 0.065]}>
          <planeGeometry args={[3.5, 0.72]} />
          <meshStandardMaterial color="#fff4d9" roughness={0.9} />
        </mesh>
        <Text position={[BOOK_WIDTH / 2, 0.58, 0.13]} fontSize={0.33} color="#2f2116" anchorX="center" anchorY="middle">
          My Footprints
        </Text>
        <Text position={[BOOK_WIDTH / 2, -0.18, 0.13]} fontSize={0.46} color="#fff8ed" anchorX="center" anchorY="middle">
          MeetU
        </Text>
        <Text position={[BOOK_WIDTH / 2, -0.58, 0.13]} fontSize={0.12} color="#dbe8d1" anchorX="center" anchorY="middle">
          TRAVEL JOURNAL
        </Text>
      </group>
    </group>
  )
}

function UnfoldingMap({ memories }: { memories: StoryMemory[] }) {
  const scroll = useScroll()
  const groupRef = useRef<Group>(null)
  const mapRef = useRef<Mesh>(null)
  const basePositionsRef = useRef<Float32Array | null>(null)
  const paperTexture = useMemo(() => (typeof document === 'undefined' ? null : makeMapTexture(memories)), [memories])

  useFrame((_, delta) => {
    const offset = scroll.offset
    const lift = phase(offset, 0.16, 0.34)
    const disappear = phase(offset, 0.32, 0.42)

    if (groupRef.current) {
      groupRef.current.visible = offset > 0.08 && offset < 0.44
      easing.damp3(groupRef.current.position, [0, mix(-0.06, 0.08, lift), mix(0.1, 0.55, lift)], 0.18, delta)
      easing.damp3(groupRef.current.scale, [1 - disappear * 0.22, 1 - disappear * 0.22, 1], 0.18, delta)
      easing.dampE(groupRef.current.rotation, [mix(-0.04, -0.22, lift), 0, Math.sin(lift * Math.PI) * 0.04], 0.18, delta)
    }

    const mesh = mapRef.current
    if (!mesh) return

    const position = mesh.geometry.getAttribute('position') as BufferAttribute
    if (!basePositionsRef.current) {
      basePositionsRef.current = new Float32Array(position.array)
    }

    const base = basePositionsRef.current
    for (let index = 0; index < position.count; index += 1) {
      const i = index * 3
      const x = base[i]
      const y = base[i + 1]
      const wave = Math.sin((x + 2.4) * 2.1 + offset * 8) * Math.sin((y + 1.4) * 1.8) * lift * (1 - disappear) * 0.18
      position.setXYZ(index, x, y, wave)
    }
    position.needsUpdate = true
    mesh.geometry.computeVertexNormals()
  })

  return (
    <group ref={groupRef}>
      <mesh ref={mapRef} castShadow receiveShadow>
        <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT, 50, 30]} />
        <meshStandardMaterial map={paperTexture ?? undefined} color="#f2e5ca" roughness={0.9} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function PaperGlobeMesh({ memories }: { memories: StoryMemory[] }) {
  const texture = useMemo(() => (typeof document === 'undefined' ? null : makeGlobeTexture(memories)), [memories])

  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[GLOBE_RADIUS, 72, 48]} />
      <meshStandardMaterial map={texture ?? undefined} color="#f2e5ca" roughness={0.88} />
    </mesh>
  )
}

function GlobeStage({ memories, focusRotationY }: { memories: StoryMemory[]; focusRotationY: number }) {
  const scroll = useScroll()
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    const offset = scroll.offset
    const appear = phase(offset, 0.25, 0.39)
    const leave = phase(offset, 0.5, 0.62)
    const scale = appear * (1 - leave * 0.96)

    if (!groupRef.current) return
    groupRef.current.visible = scale > 0.03 && offset < 0.64
    easing.damp3(groupRef.current.scale, [scale, scale, scale], 0.18, delta)
    easing.damp3(groupRef.current.position, [mix(0, -1.32, leave), mix(-0.04, 0.1, appear) + leave * 0.08, mix(0.34, 0.48, appear) - leave * 0.34], 0.18, delta)
    easing.dampE(groupRef.current.rotation, [mix(-0.7, -0.12, appear), focusRotationY + offset * 0.55, 0.04], 0.2, delta)
  })

  return (
    <group ref={groupRef}>
      <PaperGlobeMesh memories={memories} />
      {memories.map((memory, index) => (
        <PushPin key={memory.id} memory={memory} index={index} />
      ))}
      <RouteThread memories={memories} />
    </group>
  )
}

function PushPin({ memory, index }: { memory: StoryMemory; index: number }) {
  const scroll = useScroll()
  const pinRef = useRef<Group>(null)
  const rippleRef = useRef<Mesh>(null)
  const emojiTexture = useMemo(() => (typeof document === 'undefined' ? null : makeEmojiTexture(memory.emoji)), [memory.emoji])
  const point = useMemo(() => latLngToSphere(memory.lat, memory.lng, GLOBE_RADIUS + 0.06), [memory.lat, memory.lng])
  const normal = useMemo(() => point.clone().normalize(), [point])

  useFrame((_, delta) => {
    const offset = scroll.offset
    const drop = phase(offset, 0.36 + index * 0.018, 0.47 + index * 0.018)
    const leave = phase(offset, 0.58, 0.68)
    const visible = drop > 0.03 && leave < 0.98 && offset < 0.74

    setGroupVisible(pinRef.current, visible)
    if (!pinRef.current) return

    const start = point.clone().add(normal.clone().multiplyScalar(1.0))
    const landing = point.clone().add(normal.clone().multiplyScalar(0.035))
    const current = start.lerp(landing, drop)
    easing.damp3(pinRef.current.position, [current.x, current.y, current.z], 0.13, delta)
    pinRef.current.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal)
    const scale = 0.62 * (1 - leave)
    easing.damp3(pinRef.current.scale, [scale, scale, scale], 0.14, delta)

    if (rippleRef.current) {
      const ripple = Math.sin(drop * Math.PI)
      rippleRef.current.visible = ripple > 0.04 && leave < 0.1
      rippleRef.current.position.copy(point).add(normal.clone().multiplyScalar(0.045))
      rippleRef.current.quaternion.copy(pinRef.current.quaternion)
      easing.damp3(rippleRef.current.scale, [0.4 + ripple * 0.9, 0.4 + ripple * 0.9, 0.4 + ripple * 0.9], 0.12, delta)
    }
  })

  return (
    <>
      <mesh ref={rippleRef}>
        <ringGeometry args={[0.13, 0.17, 36]} />
        <meshBasicMaterial color={memory.color} transparent opacity={0.22} side={DoubleSide} blending={AdditiveBlending} />
      </mesh>
      <group ref={pinRef}>
        <mesh position={[0, -0.11, 0]} castShadow>
          <coneGeometry args={[0.045, 0.22, 22]} />
          <meshStandardMaterial color="#8c5f34" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <sphereGeometry args={[0.105, 26, 18]} />
          <meshStandardMaterial color={memory.color} roughness={0.52} />
        </mesh>
        <mesh position={[0, 0.205, 0.006]}>
          <planeGeometry args={[0.22, 0.22]} />
          <meshBasicMaterial map={emojiTexture ?? undefined} transparent />
        </mesh>
      </group>
    </>
  )
}

function RouteThread({ memories }: { memories: StoryMemory[] }) {
  const scroll = useScroll()
  const groupRef = useRef<Group>(null)
  const points = useMemo(() => (
    memories.map((memory) => latLngToSphere(memory.lat, memory.lng, GLOBE_RADIUS + 0.09))
  ), [memories])

  useFrame((_, delta) => {
    const offset = scroll.offset
    const draw = phase(offset, 0.44, 0.56) * (1 - phase(offset, 0.6, 0.7))
    setGroupVisible(groupRef.current, draw > 0.03 && points.length > 1)
    if (!groupRef.current) return
    easing.damp3(groupRef.current.scale, [draw, draw, draw], 0.16, delta)
  })

  if (points.length < 2) return null

  return (
    <group ref={groupRef}>
      <Line points={points} color="#8f6a49" lineWidth={2.5} dashed dashSize={0.12} gapSize={0.08} transparent opacity={0.78} />
    </group>
  )
}

function FeatureMemory({ memory }: { memory: StoryMemory }) {
  const scroll = useScroll()
  const groupRef = useRef<Group>(null)
  const texture = useMemo(() => (typeof document === 'undefined' ? null : makePhotoTexture(memory, 0)), [memory])

  useFrame((_, delta) => {
    const offset = scroll.offset
    const show = phase(offset, 0.56, 0.68) * (1 - phase(offset, 0.72, 0.8))
    setGroupVisible(groupRef.current, show > 0.03)
    if (!groupRef.current) return
    easing.damp3(groupRef.current.position, [-0.12, mix(-0.18, 0.02, show), 0.76], 0.16, delta)
    easing.damp3(groupRef.current.scale, [show * 0.92, show * 0.92, show * 0.92], 0.16, delta)
    easing.dampE(groupRef.current.rotation, [0.03, 0, 0.02], 0.18, delta)
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow position={[-0.82, 0, 0]}>
        <boxGeometry args={[1.35, 1.72, 0.04]} />
        <meshStandardMaterial color="#fffaf0" roughness={0.74} />
      </mesh>
      <mesh position={[-0.82, 0.18, 0.03]}>
        <planeGeometry args={[1.12, 1.08]} />
        <meshStandardMaterial map={texture ?? undefined} color="#eadac0" roughness={0.82} />
      </mesh>
      <Text position={[0.28, 0.62, 0.04]} fontSize={0.07} color="#6f8a68" anchorX="left" maxWidth={1.7}>
        FIRST MEMORY
      </Text>
      <Text position={[0.28, 0.35, 0.04]} fontSize={0.2} color="#302216" anchorX="left" maxWidth={1.8}>
        {memory.title}
      </Text>
      <Text position={[0.28, 0.05, 0.04]} fontSize={0.1} color="#6f8a68" anchorX="left" maxWidth={1.65}>
        {memory.place}
      </Text>
      <Text position={[0.28, -0.24, 0.04]} fontSize={0.105} color="#755f44" anchorX="left" maxWidth={1.9}>
        {memory.content}
      </Text>
    </group>
  )
}

function Polaroid({ memory, index, total }: { memory: StoryMemory; index: number; total: number }) {
  const scroll = useScroll()
  const groupRef = useRef<Group>(null)
  const texture = useMemo(() => (typeof document === 'undefined' ? null : makePhotoTexture(memory, index)), [memory, index])
  const linePosition = useMemo(() => {
    const count = Math.max(1, Math.min(total, 5))
    const spacing = count > 3 ? 1.05 : 1.28
    const start = -((count - 1) * spacing) / 2
    return new Vector3(start + index * spacing, index % 2 === 0 ? 0.22 : -0.22, 0.76)
  }, [index, total])
  const posterPosition = useMemo(() => {
    if (total <= 2) {
      return new Vector3(total === 1 ? 0 : -0.62 + index * 1.24, 0.24, 0.14)
    }

    const columns = total <= 4 ? 2 : 3
    const col = index % columns
    const row = Math.floor(index / columns)
    const spacingX = columns === 2 ? 1.22 : 1.08
    const start = -((columns - 1) * spacingX) / 2
    return new Vector3(start + col * spacingX, 0.62 - row * 1.25, 0.14)
  }, [index, total])

  useFrame((state, delta) => {
    const offset = scroll.offset
    const line = phase(offset, 0.72 + index * 0.008, 0.86 + index * 0.008)
    const poster = phase(offset, 0.86, 0.98)
    const show = phase(offset, 0.7 + index * 0.01, 0.78 + index * 0.01)
    const target = linePosition.clone().lerp(posterPosition, poster)
    if (line < 0.05) target.y -= 0.38 * (1 - line)

    setGroupVisible(groupRef.current, show > 0.03)
    if (!groupRef.current) return

    easing.damp3(groupRef.current.position, [target.x, target.y, target.z], 0.17, delta)
    const posterScale = total <= 2 ? 1.04 : 0.82
    const targetScale = show * mix(0.88, posterScale, poster)
    easing.damp3(groupRef.current.scale, [targetScale, targetScale, targetScale], 0.14, delta)
    easing.dampE(
      groupRef.current.rotation,
      [
        poster ? 0 : Math.sin(state.clock.elapsedTime * 1.2 + index) * 0.035,
        0,
        poster ? 0 : (memory.rotation * Math.PI) / 180 + Math.sin(state.clock.elapsedTime + index) * 0.025,
      ],
      0.16,
      delta,
    )
  })

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.68, 0.065]}>
        <boxGeometry args={[0.18, 0.18, 0.08]} />
        <meshStandardMaterial color="#c99e63" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.66, 0.12]} rotation={[0, 0, 0.1]}>
        <planeGeometry args={[0.44, 0.11]} />
        <meshStandardMaterial color="#f1cd86" roughness={0.86} transparent opacity={0.72} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.03, 1.3, 0.035]} />
        <meshStandardMaterial color="#fffaf0" roughness={0.76} />
      </mesh>
      <mesh position={[0, 0.14, 0.025]}>
        <planeGeometry args={[0.84, 0.84]} />
        <meshStandardMaterial map={texture ?? undefined} color="#eadac0" roughness={0.82} />
      </mesh>
      <Text position={[0, -0.47, 0.045]} fontSize={0.082} color="#35271b" anchorX="center" maxWidth={0.82}>
        {memory.title}
      </Text>
    </group>
  )
}

function Clothesline() {
  const scroll = useScroll()
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    const show = phase(scroll.offset, 0.7, 0.82) * (1 - phase(scroll.offset, 0.88, 0.96))
    setGroupVisible(groupRef.current, show > 0.03)
    if (!groupRef.current) return
    easing.damp3(groupRef.current.scale, [show, show, show], 0.16, delta)
  })

  return (
    <group ref={groupRef}>
      <Line points={[[-2.45, 0.78, 0.74], [-0.85, 0.9, 0.74], [0.85, 0.8, 0.74], [2.45, 0.9, 0.74]]} color="#8c6a47" lineWidth={2.2} transparent opacity={0.72} />
    </group>
  )
}

function PosterBase({ memories, userName }: { memories: StoryMemory[]; userName: string }) {
  const scroll = useScroll()
  const groupRef = useRef<Group>(null)
  const texture = useMemo(() => (typeof document === 'undefined' ? null : makePosterTexture()), [])
  const places = useMemo(() => uniquePlaces(memories), [memories])
  const dateRange = useMemo(() => {
    if (!memories.length) return 'A gentle travel archive'
    const first = memories[0]
    const last = memories[memories.length - 1]
    const start = formatShortDate(first.memoryTime)
    const end = formatShortDate(last.memoryTime)
    return start === end ? start : `${start} - ${end}`
  }, [memories])
  const placeLine = places.length ? places.slice(0, 3).join(' · ') : 'Saved places'

  useFrame((_, delta) => {
    const show = phase(scroll.offset, 0.86, 0.98)
    setGroupVisible(groupRef.current, show > 0.03)
    if (!groupRef.current) return
    easing.damp3(groupRef.current.scale, [show, show, show], 0.16, delta)
    easing.damp3(groupRef.current.position, [0, 0, 0.02], 0.16, delta)
  })

  return (
    <group ref={groupRef}>
      <mesh receiveShadow>
        <boxGeometry args={[4.7, 5.1, 0.05]} />
        <meshStandardMaterial map={texture ?? undefined} color="#fff8ed" roughness={0.9} />
      </mesh>
      <mesh position={[-1.56, 2.28, 0.075]} rotation={[0, 0, -0.08]}>
        <planeGeometry args={[0.9, 0.18]} />
        <meshStandardMaterial color="#f1cd86" roughness={0.86} transparent opacity={0.62} />
      </mesh>
      <mesh position={[1.56, 2.26, 0.075]} rotation={[0, 0, 0.1]}>
        <planeGeometry args={[0.9, 0.18]} />
        <meshStandardMaterial color="#f1cd86" roughness={0.86} transparent opacity={0.58} />
      </mesh>
      <Text position={[0, 2.04, 0.09]} fontSize={0.22} color="#302216" anchorX="center" maxWidth={3.4}>
        My Footprints
      </Text>
      <Text position={[0, 1.78, 0.09]} fontSize={0.085} color="#6f8a68" anchorX="center" maxWidth={3.4}>
        {userName}&apos;s MeetU travel scrapbook
      </Text>
      <mesh position={[-1.12, 1.48, 0.08]}>
        <boxGeometry args={[1.25, 0.33, 0.028]} />
        <meshStandardMaterial color="#e1efd9" roughness={0.88} />
      </mesh>
      <mesh position={[1.12, 1.48, 0.08]}>
        <boxGeometry args={[1.25, 0.33, 0.028]} />
        <meshStandardMaterial color="#f3dfb9" roughness={0.88} />
      </mesh>
      <Text position={[-1.12, 1.5, 0.115]} fontSize={0.085} color="#416845" anchorX="center">
        {memories.length} memories
      </Text>
      <Text position={[1.12, 1.5, 0.115]} fontSize={0.075} color="#7a5d35" anchorX="center" maxWidth={1.05}>
        {dateRange}
      </Text>
      <Text position={[0, -1.38, 0.09]} fontSize={0.095} color="#302216" anchorX="center" maxWidth={3.35}>
        {placeLine}
      </Text>
      <Text position={[0, -1.62, 0.09]} fontSize={0.07} color="#806a4d" anchorX="center" maxWidth={3.2}>
        small moments gathered into one soft page
      </Text>
      <Text position={[-1.82, -2.16, 0.09]} fontSize={0.075} color="#6f8a68" anchorX="left">
        Made with MeetU
      </Text>
      <Text position={[1.2, -2.16, 0.09]} fontSize={0.075} color="#806a4d" anchorX="left">
        Travel scrapbook
      </Text>
    </group>
  )
}

function Scene({ memories, userName }: { memories: StoryMemory[]; userName: string }) {
  const scroll = useScroll()
  const firstPinLocal = useMemo(() => latLngToSphere(memories[0].lat, memories[0].lng, GLOBE_RADIUS + 0.2), [memories])
  const focusRotationY = useMemo(() => Math.atan2(-firstPinLocal.x, firstPinLocal.z), [firstPinLocal])
  const firstPin = useMemo(() => (
    rotateY(firstPinLocal, focusRotationY + 0.28).add(new Vector3(0, 0.1, 0.48))
  ), [firstPinLocal, focusRotationY])
  const cameraTarget = useRef(new Vector3(0, 0, 0.25))

  useFrame((state, delta) => {
    const offset = scroll.offset
    const coverView = new Vector3(0, 0.08, 6.0)
    const globeView = new Vector3(0, 0.12, 5.05)
    const pinView = new Vector3(firstPin.x * 0.54, firstPin.y * 0.48, 3.35)
    const memoryView = new Vector3(0, 0.1, 4.25)
    const lineView = new Vector3(mix(-1.8, 1.65, phase(offset, 0.72, 0.86)), 0.18, 4.35)
    const posterView = new Vector3(0, 0.12, 6.3)

    const cameraPosition = coverView
      .clone()
      .lerp(globeView, phase(offset, 0.18, 0.36))
      .lerp(pinView, phase(offset, 0.48, 0.6))
      .lerp(memoryView, phase(offset, 0.58, 0.7))
      .lerp(lineView, phase(offset, 0.7, 0.86))
      .lerp(posterView, phase(offset, 0.86, 1))

    cameraTarget.current
      .set(0, 0, 0.12)
      .lerp(firstPin, phase(offset, 0.48, 0.6))
      .lerp(new Vector3(0, 0, 0.65), phase(offset, 0.58, 0.7))
      .lerp(new Vector3(0, 0, 0.08), phase(offset, 0.86, 1))

    easing.damp3(state.camera.position, cameraPosition, 0.22, delta)
    easing.dampLookAt(state.camera as PerspectiveCamera, cameraTarget.current, 0.22, delta)
  })

  return (
    <>
      <ambientLight intensity={2.25} />
      <directionalLight position={[3.5, 4.2, 5.4]} intensity={3.2} color="#fff1d7" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-2.6, 1.6, 3.2]} intensity={1.05} color="#e8c28a" />
      <Desktop />
      <JournalBook />
      <UnfoldingMap memories={memories} />
      <GlobeStage memories={memories} focusRotationY={focusRotationY} />
      <FeatureMemory memory={memories[0]} />
      <PosterBase memories={memories} userName={userName} />
      <Clothesline />
      {memories.slice(0, 5).map((memory, index, visibleMemories) => (
        <Polaroid key={memory.id} memory={memory} index={index} total={visibleMemories.length} />
      ))}
    </>
  )
}

export function FootprintStoryExperience({ userName }: Props) {
  const realMemories = useClientMemories()
  const memories = realMemories.length ? realMemories : SAMPLE_MEMORIES

  return (
    <main className="footprint-canvas-story">
      <Canvas
        shadows
        camera={{ position: [0, 0.08, 6.0], fov: 40 }}
        dpr={[1, 1.7]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#f6eddb']} />
        <fog attach="fog" args={['#f6eddb', 6.2, 10.5]} />
        <ScrollControls pages={7} damping={0.25}>
          <Scene memories={memories} userName={userName} />
        </ScrollControls>
      </Canvas>
    </main>
  )
}
