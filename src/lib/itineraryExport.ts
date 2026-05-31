import type { Itinerary } from '@/types/travel'

function line(value = '') {
  return `${value}\n`
}

export function itineraryToMarkdown(itinerary: Itinerary) {
  const trip = itinerary.trip
  const lines: string[] = []

  lines.push(line(`# ${trip.destination} Travel Plan`))
  lines.push(line(`${trip.startDate} to ${trip.endDate} · ${trip.travelers} ${trip.travelers === 1 ? 'traveler' : 'travelers'} · ${trip.style}`))
  lines.push(line())
  lines.push(line(itinerary.summary))
  lines.push(line())

  for (const day of itinerary.days) {
    lines.push(line(`## Day ${day.day}: ${day.theme}`))
    lines.push(line(day.date))
    lines.push(line())

    for (const activity of day.activities) {
      lines.push(line(`### ${activity.time}: ${activity.title}`))
      lines.push(line(`Location: ${activity.location}`))
      lines.push(line(`Type: ${activity.type}`))
      if (activity.coordinates) {
        lines.push(line(`Coordinates: ${activity.coordinates.lat}, ${activity.coordinates.lng}`))
      }
      lines.push(line(activity.description))
      lines.push(line())
    }
  }

  if (itinerary.tips.length > 0) {
    lines.push(line('## Tips'))
    for (const tip of itinerary.tips) {
      lines.push(line(`- ${tip}`))
    }
  }

  return lines.join('')
}

export function downloadItineraryMarkdown(itinerary: Itinerary) {
  const markdown = itineraryToMarkdown(itinerary)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const fileBase = itinerary.trip.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  anchor.href = url
  anchor.download = `${fileBase || 'trip'}-itinerary.md`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
