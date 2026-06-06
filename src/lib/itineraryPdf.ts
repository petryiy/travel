import type { Activity, DayPlan, Itinerary } from '@/types/travel'

interface PdfOptions {
  title: string
  authorName?: string | null
}

type FontName = 'regular' | 'bold'

interface TextOptions {
  font?: FontName
  size?: number
  leading?: number
  x?: number
  maxWidth?: number
  color?: number
  spaceAfter?: number
}

interface PdfPage {
  commands: string[]
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN_X = 48
const MARGIN_TOP = 54
const MARGIN_BOTTOM = 54

const FONT_REF: Record<FontName, string> = {
  regular: 'F1',
  bold: 'F2',
}

function sanitizeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/•/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdfText(value: string) {
  return sanitizeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function slugify(value: string) {
  return sanitizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
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
  return activity.time[0].toUpperCase() + activity.time.slice(1)
}

function formatDayWindow(day: DayPlan, itinerary: Itinerary) {
  const start = day.startTime ?? itinerary.trip.dailyStartTime
  const end = day.endTime ?? itinerary.trip.dailyEndTime

  if (start && end) return `${start} - ${end}`
  if (start) return `from ${start}`
  if (end) return `until ${end}`
  return null
}

function measureText(value: string, size: number, font: FontName) {
  const weight = font === 'bold' ? 0.56 : 0.5
  return sanitizeText(value).length * size * weight
}

function wrapText(value: string, maxWidth: number, size: number, font: FontName) {
  const words = sanitizeText(value).split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measureText(candidate, size, font) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)

    if (measureText(word, size, font) <= maxWidth) {
      current = word
      continue
    }

    let chunk = ''
    for (const char of word) {
      const next = `${chunk}${char}`
      if (measureText(next, size, font) <= maxWidth) {
        chunk = next
      } else {
        if (chunk) lines.push(chunk)
        chunk = char
      }
    }
    current = chunk
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function drawTextCommand(text: string, x: number, y: number, options: Required<Pick<TextOptions, 'font' | 'size' | 'color'>>) {
  const color = `${options.color} ${options.color} ${options.color} rg`
  return `BT ${color} /${FONT_REF[options.font]} ${options.size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`
}

function drawLineCommand(x1: number, y: number, x2: number) {
  return `0.82 G 0.6 w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`
}

class PdfWriter {
  private pages: PdfPage[] = []
  private y = PAGE_HEIGHT - MARGIN_TOP

  constructor() {
    this.newPage()
  }

  private currentPage() {
    return this.pages[this.pages.length - 1]
  }

  private newPage() {
    this.pages.push({ commands: [] })
    this.y = PAGE_HEIGHT - MARGIN_TOP
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN_BOTTOM) this.newPage()
  }

  addText(text: string, options: TextOptions = {}) {
    const font = options.font ?? 'regular'
    const size = options.size ?? 10.5
    const leading = options.leading ?? size * 1.35
    const x = options.x ?? MARGIN_X
    const maxWidth = options.maxWidth ?? PAGE_WIDTH - x - MARGIN_X
    const color = options.color ?? 0
    const lines = wrapText(text, maxWidth, size, font)

    for (const line of lines) {
      this.ensureSpace(leading)
      this.currentPage().commands.push(drawTextCommand(line, x, this.y, { font, size, color }))
      this.y -= leading
    }

    if (options.spaceAfter) this.y -= options.spaceAfter
  }

  addRule(spaceBefore = 2, spaceAfter = 12) {
    this.ensureSpace(spaceBefore + spaceAfter + 1)
    this.y -= spaceBefore
    this.currentPage().commands.push(drawLineCommand(MARGIN_X, this.y, PAGE_WIDTH - MARGIN_X))
    this.y -= spaceAfter
  }

  addGap(height: number) {
    this.ensureSpace(height)
    this.y -= height
  }

  toPages() {
    return this.pages
  }
}

function buildItineraryPages(itinerary: Itinerary, options: PdfOptions) {
  const writer = new PdfWriter()
  const title = sanitizeText(options.title || itinerary.trip.destination)
  const author = sanitizeText(options.authorName || 'MeetU traveler')

  writer.addText(title, { font: 'bold', size: 25, leading: 31, spaceAfter: 4 })
  writer.addText(`Travel itinerary for ${itinerary.trip.destination}`, { size: 12, color: 0.28, spaceAfter: 2 })
  writer.addText(`Created by ${author}`, { size: 10.5, color: 0.36, spaceAfter: 8 })
  writer.addRule(2, 14)

  writer.addText(`Dates: ${formatDateRange(itinerary.trip.startDate, itinerary.trip.endDate)}`, { font: 'bold' })
  writer.addText(`Travelers: ${itinerary.trip.travelers}`, { font: 'bold' })
  writer.addText(`Style: ${itinerary.trip.style}`, { font: 'bold' })
  writer.addText(`Daily window: ${itinerary.trip.dailyStartTime} - ${itinerary.trip.dailyEndTime}`, { font: 'bold' })
  if (itinerary.trip.accommodationLocation) {
    writer.addText(`Accommodation area: ${itinerary.trip.accommodationLocation}`, { font: 'bold' })
  }
  writer.addGap(8)
  writer.addText('Summary', { font: 'bold', size: 15, leading: 20, spaceAfter: 2 })
  writer.addText(itinerary.summary, { size: 10.8, leading: 15, spaceAfter: 12 })

  writer.addText('Daily Plan', { font: 'bold', size: 17, leading: 22, spaceAfter: 4 })

  for (const day of itinerary.days) {
    const window = formatDayWindow(day, itinerary)
    writer.addRule(1, 10)
    writer.addText(`Day ${day.day}: ${day.theme}`, { font: 'bold', size: 14.5, leading: 19 })
    writer.addText(`${formatDate(day.date)}${window ? ` | ${window}` : ''}`, { size: 10.5, color: 0.32, spaceAfter: 5 })

    day.activities.forEach((activity, index) => {
      writer.addText(`${formatTimeRange(activity)}  ${activity.title}`, { font: 'bold', size: 11.3, leading: 15 })
      writer.addText(`Location: ${activity.location}`, { size: 10, color: 0.28, x: MARGIN_X + 14 })
      writer.addText(activity.description, { size: 10.2, leading: 14, x: MARGIN_X + 14 })

      if (activity.travelFromPrevious) {
        writer.addText(
          `Travel from previous stop: ${activity.travelFromPrevious.durationMinutes} min ${activity.travelFromPrevious.mode} - ${activity.travelFromPrevious.description}`,
          { size: 9.7, leading: 13.5, color: 0.34, x: MARGIN_X + 14 }
        )
      }

      if (activity.isFixedTime) {
        writer.addText('Fixed-time booking', { size: 9.5, color: 0.34, x: MARGIN_X + 14 })
      }

      if (index < day.activities.length - 1) writer.addGap(6)
    })
  }

  if (itinerary.tips.length > 0) {
    writer.addRule(4, 10)
    writer.addText('Notes', { font: 'bold', size: 15, leading: 20, spaceAfter: 3 })
    for (const tip of itinerary.tips) {
      writer.addText(`- ${tip}`, { size: 10.4, leading: 14.5, x: MARGIN_X + 8 })
    }
  }

  return writer.toPages()
}

function createPdfBytes(pages: PdfPage[]) {
  const encoder = new TextEncoder()
  const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>']
  const pageObjectNumbers: number[] = []

  pages.forEach((page, index) => {
    const pageNumber = index + 1
    const footerY = 30
    const footerLeft = drawTextCommand('Generated by MeetU', MARGIN_X, footerY, { font: 'regular', size: 8.5, color: 0.45 })
    const footerRight = drawTextCommand(`Page ${pageNumber} of ${pages.length}`, PAGE_WIDTH - MARGIN_X - 58, footerY, {
      font: 'regular',
      size: 8.5,
      color: 0.45,
    })
    const stream = [...page.commands, footerLeft, footerRight].join('\n')
    const streamLength = encoder.encode(stream).length
    const contentObjectNumber = objects.push(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`)
    const pageObjectNumber = objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    )
    pageObjectNumbers.push(pageObjectNumber)
  })

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`

  const chunks: string[] = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n']
  const offsets = [0]
  let byteOffset = encoder.encode(chunks[0]).length

  objects.forEach((object, index) => {
    offsets.push(byteOffset)
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`
    chunks.push(chunk)
    byteOffset += encoder.encode(chunk).length
  })

  const xrefOffset = byteOffset
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}`,
    '%%EOF',
  ].join('\n')

  chunks.push(xref)
  return encoder.encode(chunks.join(''))
}

export function createItineraryPdfBlob(itinerary: Itinerary, options: PdfOptions) {
  return new Blob([createPdfBytes(buildItineraryPages(itinerary, options))], { type: 'application/pdf' })
}

export function downloadItineraryPdf(itinerary: Itinerary, options: PdfOptions) {
  const blob = createItineraryPdfBlob(itinerary, options)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${slugify(options.title || itinerary.trip.destination) || 'travel-itinerary'}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}
