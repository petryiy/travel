import type { Activity, Itinerary, KeyLocation } from '@/types/travel'

const POSTER_WIDTH = 1080
const SIDE = 72
const COLORS = ['#456b72', '#a66445', '#6a7f49', '#87659a', '#b88438', '#4f7357']
const PAPER = '#fff7e7'
const INK = '#35271b'

interface PosterOptions {
  title: string
  caption: string
}

interface DrawContext {
  ctx: CanvasRenderingContext2D
  y: number
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

function formatTime(activity: Activity) {
  if (activity.startTime && activity.endTime) return `${activity.startTime}-${activity.endTime}`
  if (activity.startTime) return activity.startTime
  return activity.time
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function drawFilledRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string
) {
  roundRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = fill
  ctx.fill()

  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  })

  if (line) lines.push(line)
  return lines
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number
) {
  const lines = wrapText(ctx, text, maxWidth)
  const visible = maxLines ? lines.slice(0, maxLines) : lines

  visible.forEach((line, index) => {
    const suffix = maxLines && index === maxLines - 1 && lines.length > maxLines ? '...' : ''
    ctx.fillText(`${line}${suffix}`, x, y + index * lineHeight)
  })

  return visible.length * lineHeight
}

function drawPaperTexture(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#eadfc8'
  ctx.fillRect(0, 0, width, height)

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#fbf0d9')
  gradient.addColorStop(0.48, '#efe5cf')
  gradient.addColorStop(1, '#e4d4bb')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = PAPER
  drawFilledRoundRect(ctx, 36, 34, width - 72, height - 68, 26, PAPER, '#b79f79')

  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#7c6649'
  for (let y = 72; y < height - 72; y += 32) {
    ctx.fillRect(68, y, width - 136, 1)
  }

  ctx.globalAlpha = 0.14
  for (let x = 64; x < width - 64; x += 9) {
    for (let y = 64; y < height - 64; y += 9) {
      ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.globalAlpha = 1
}

function drawTape(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, rotation: number) {
  ctx.save()
  ctx.translate(x + width / 2, y + 15)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.fillStyle = 'rgba(247, 208, 138, 0.75)'
  ctx.fillRect(-width / 2, -15, width, 30)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  for (let i = -width / 2; i < width / 2; i += 18) {
    ctx.fillRect(i, -15, 8, 30)
  }
  ctx.restore()
}

function drawChip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, color: string) {
  ctx.font = '700 25px Arial, sans-serif'
  const width = Math.min(ctx.measureText(text).width + 34, POSTER_WIDTH - SIDE * 2)
  drawFilledRoundRect(ctx, x, y, width, 42, 10, fill, 'rgba(70,52,31,0.28)')
  ctx.fillStyle = color
  ctx.fillText(text, x + 17, y + 29)
  return width
}

function getTimelineHeight(itinerary: Itinerary) {
  return itinerary.days.reduce((total, day) => total + 120 + day.activities.length * 58, 0)
}

function getPosterHeight(itinerary: Itinerary) {
  return Math.max(1920, 1160 + getTimelineHeight(itinerary))
}

function getMapLocations(itinerary: Itinerary) {
  const activityLocations = itinerary.days.flatMap((day) =>
    day.activities
      .filter((activity) => activity.coordinates)
      .map((activity, index) => ({
        name: activity.location || activity.title,
        lat: activity.coordinates?.lat ?? itinerary.mapCenter.lat,
        lng: activity.coordinates?.lng ?? itinerary.mapCenter.lng,
        day: day.day,
        order: index + 1,
        title: activity.title,
      }))
  )

  return activityLocations.length > 0 ? activityLocations : itinerary.keyLocations
}

function getDayMapLocations(itinerary: Itinerary, dayNumber: number) {
  const locations = getMapLocations(itinerary).filter((location) => location.day === dayNumber)
  const unique: KeyLocation[] = []

  locations.forEach((location) => {
    const previous = unique[unique.length - 1]
    if (previous && Math.abs(previous.lat - location.lat) < 0.0001 && Math.abs(previous.lng - location.lng) < 0.0001) {
      return
    }

    unique.push(location)
  })

  return unique
}

function encodePayload(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function buildGoogleStaticMapUrl(itinerary: Itinerary, width: number, height: number) {
  const groups = itinerary.days.map((day, index) => ({
    color: COLORS[index % COLORS.length],
    points: getDayMapLocations(itinerary, day.day).map((location) => ({
      lat: location.lat,
      lng: location.lng,
    })),
  }))

  const payload = {
    center: itinerary.mapCenter,
    width,
    height,
    paths: groups,
    markers: groups,
  }

  return `/api/maps/static?payload=${encodePayload(payload)}`
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function drawRouteSummaryFallback(ctx: CanvasRenderingContext2D, itinerary: Itinerary, x: number, y: number, width: number, height: number) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
  gradient.addColorStop(0, '#dbe9ef')
  gradient.addColorStop(1, '#f8ecd0')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, width, height)

  ctx.fillStyle = 'rgba(255,250,240,0.78)'
  drawFilledRoundRect(ctx, x + 36, y + 72, width - 72, height - 108, 18, 'rgba(255,250,240,0.78)', 'rgba(113,88,55,0.22)')

  itinerary.days.forEach((day, index) => {
    const locations = getDayMapLocations(itinerary, day.day)
    const first = locations[0]?.name ?? day.activities[0]?.location ?? 'Start'
    const last = locations[locations.length - 1]?.name ?? day.activities[day.activities.length - 1]?.location ?? 'Finish'
    const lineY = y + 114 + index * 58
    const color = COLORS[index % COLORS.length]

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x + 68, lineY - 7, 11, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = INK
    ctx.font = '700 21px Arial, sans-serif'
    ctx.fillText(`Day ${day.day}`, x + 90, lineY)

    ctx.fillStyle = '#66523b'
    ctx.font = '600 18px Arial, sans-serif'
    drawWrappedText(ctx, `${first} to ${last} · ${day.activities.length} stops`, x + 176, lineY, width - 230, 22, 1)
  })
}

function drawMapLegend(ctx: CanvasRenderingContext2D, itinerary: Itinerary, x: number, y: number, width: number, height: number) {
  const legendX = x + 28
  const legendY = y + height - 48

  ctx.fillStyle = 'rgba(255,250,240,0.86)'
  drawFilledRoundRect(ctx, legendX - 12, legendY - 24, width - 56, 36, 12, 'rgba(255,250,240,0.86)', 'rgba(113,88,55,0.2)')

  let cursor = legendX
  itinerary.days.forEach((day, index) => {
    const label = `Day ${day.day}`
    const color = COLORS[index % COLORS.length]

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cursor + 10, legendY - 6, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#4e3c29'
    ctx.font = '700 15px Arial, sans-serif'
    ctx.fillText(label, cursor + 24, legendY)
    cursor += ctx.measureText(label).width + 58
  })
}

async function drawRouteMap(ctx: CanvasRenderingContext2D, itinerary: Itinerary, x: number, y: number, width: number, height: number) {
  drawFilledRoundRect(ctx, x, y, width, height, 22, '#e6efd9', '#9f8b67')

  ctx.save()
  roundRect(ctx, x, y, width, height, 22)
  ctx.clip()

  const googleMapUrl = buildGoogleStaticMapUrl(itinerary, Math.round(width), Math.round(height))

  try {
    const mapImage = await loadImage(googleMapUrl)
    ctx.drawImage(mapImage, x, y, width, height)
    ctx.fillStyle = 'rgba(255, 250, 240, 0.1)'
    ctx.fillRect(x, y, width, height)
  } catch {
    drawRouteSummaryFallback(ctx, itinerary, x, y, width, height)
  }

  ctx.restore()

  ctx.fillStyle = '#3b2d20'
  ctx.font = '700 30px Georgia, serif'
  ctx.fillText('Google route map', x + 30, y + 45)
  drawMapLegend(ctx, itinerary, x, y, width, height)
}

async function drawHeader(draw: DrawContext, itinerary: Itinerary, title: string, caption: string) {
  const { ctx } = draw
  drawTape(ctx, 98, 36, 190, -5)
  drawTape(ctx, 786, 38, 150, 4)

  ctx.fillStyle = '#516e4e'
  ctx.font = '700 24px Arial, sans-serif'
  ctx.fillText('TRAVEL JOURNAL POSTER', SIDE, 112)

  ctx.fillStyle = INK
  ctx.font = '700 72px Georgia, serif'
  const titleHeight = drawWrappedText(ctx, title, SIDE, 196, 760, 78, 3)

  const captionY = 222 + titleHeight
  ctx.font = '700 22px Georgia, serif'
  const captionLines = wrapText(ctx, caption, 740).slice(0, 3)
  const captionHeight = 42 + captionLines.length * 30
  drawFilledRoundRect(ctx, SIDE, captionY, 820, captionHeight, 16, 'rgba(219, 233, 211, 0.78)', 'rgba(75, 105, 78, 0.22)')
  ctx.fillStyle = '#496248'
  captionLines.forEach((line, index) => {
    ctx.fillText(line, SIDE + 28, captionY + 42 + index * 30)
  })

  ctx.font = '600 27px Arial, sans-serif'
  ctx.fillStyle = '#735d43'
  const metaY = captionY + captionHeight + 42
  ctx.fillText(formatDateRange(itinerary.trip.startDate, itinerary.trip.endDate), SIDE, metaY)

  let chipX = SIDE
  const chipY = metaY + 38
  chipX += drawChip(ctx, `${itinerary.days.length} days`, chipX, chipY, '#dbe9d3', '#496248') + 12
  chipX += drawChip(
    ctx,
    `${itinerary.trip.travelers} ${itinerary.trip.travelers === 1 ? 'traveler' : 'travelers'}`,
    chipX,
    chipY,
    '#dce9ef',
    '#3f6070'
  ) + 12

  if (itinerary.trip.accommodationLocation && chipX < 700) {
    drawChip(ctx, `Stay: ${itinerary.trip.accommodationLocation}`, chipX, chipY, '#f7ddb7', '#694c28')
  }

  const mapY = chipY + 80
  await drawRouteMap(ctx, itinerary, SIDE, mapY, POSTER_WIDTH - SIDE * 2, 378)
  draw.y = mapY + 430
}

function drawDay(draw: DrawContext, day: Itinerary['days'][number], dayIndex: number) {
  const { ctx } = draw
  const x = SIDE
  const width = POSTER_WIDTH - SIDE * 2
  const cardHeight = 94 + day.activities.length * 54
  const color = COLORS[dayIndex % COLORS.length]

  drawFilledRoundRect(ctx, x, draw.y, width, cardHeight, 20, 'rgba(255,250,240,0.72)', 'rgba(113,88,55,0.28)')
  drawTape(ctx, x + 36, draw.y - 10, 120, -4)

  ctx.fillStyle = color
  ctx.font = '700 24px Arial, sans-serif'
  ctx.fillText(`Day ${day.day}`, x + 34, draw.y + 46)

  ctx.fillStyle = INK
  ctx.font = '700 36px Georgia, serif'
  ctx.fillText(day.theme, x + 142, draw.y + 48)

  ctx.fillStyle = '#735d43'
  ctx.font = '700 20px Arial, sans-serif'
  ctx.fillText(formatDate(day.date), x + 34, draw.y + 78)

  let lineY = draw.y + 124
  day.activities.forEach((activity, index) => {
    ctx.strokeStyle = 'rgba(114,91,57,0.18)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + 34, lineY - 32)
    ctx.lineTo(x + width - 34, lineY - 32)
    ctx.stroke()

    ctx.fillStyle = '#fff6d9'
    ctx.strokeStyle = '#b79f79'
    ctx.lineWidth = 2
    roundRect(ctx, x + 34, lineY - 22, 150, 34, 8)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#634b31'
    ctx.font = '700 18px Arial, sans-serif'
    ctx.fillText(formatTime(activity), x + 48, lineY + 1)

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x + 214, lineY - 6, 9, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = INK
    ctx.font = '700 24px Arial, sans-serif'
    drawWrappedText(ctx, activity.title, x + 238, lineY + 2, width - 300, 28, 1)

    if (index === day.activities.length - 1) {
      ctx.strokeStyle = 'rgba(114,91,57,0.18)'
      ctx.beginPath()
      ctx.moveTo(x + 34, lineY + 22)
      ctx.lineTo(x + width - 34, lineY + 22)
      ctx.stroke()
    }

    lineY += 54
  })

  draw.y += cardHeight + 26
}

function drawFooter(draw: DrawContext, itinerary: Itinerary) {
  const { ctx } = draw
  ctx.fillStyle = '#6c5840'
  ctx.font = '700 20px Arial, sans-serif'
  ctx.fillText(`Made for ${itinerary.trip.destination}`, SIDE, draw.y + 22)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#8a765c'
  ctx.font = '600 17px Arial, sans-serif'
  ctx.fillText('AI Travel Planner', POSTER_WIDTH - SIDE, draw.y + 22)
  ctx.textAlign = 'left'
}

export async function createItineraryPosterDataUrl(itinerary: Itinerary, options: PosterOptions) {
  const canvas = document.createElement('canvas')
  const height = getPosterHeight(itinerary)
  canvas.width = POSTER_WIDTH
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create poster canvas.')

  drawPaperTexture(ctx, POSTER_WIDTH, height)
  const draw: DrawContext = { ctx, y: SIDE }
  await drawHeader(draw, itinerary, options.title, options.caption)
  itinerary.days.forEach((day, index) => drawDay(draw, day, index))
  drawFooter(draw, itinerary)

  return canvas.toDataURL('image/png')
}

export function downloadPosterDataUrl(dataUrl: string, title: string) {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `${slugify(title) || 'travel'}-poster.png`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
