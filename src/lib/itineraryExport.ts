import type { Itinerary } from '@/types/travel'

function line(value = '') {
  return `${value}\n`
}

export function itineraryToMarkdown(itinerary: Itinerary) {
  const trip = itinerary.trip
  const lines: string[] = []

  lines.push(line(`# ${trip.destination} Travel Plan`))
  lines.push(line(`${trip.startDate} to ${trip.endDate} · ${trip.travelers} ${trip.travelers === 1 ? 'traveler' : 'travelers'} · ${trip.style}`))
  lines.push(line(`Available window: ${trip.dailyStartTime ?? '09:00'} - ${trip.dailyEndTime ?? '21:00'}`))
  lines.push(line())
  lines.push(line(itinerary.summary))
  lines.push(line())

  for (const day of itinerary.days) {
    lines.push(line(`## Day ${day.day}: ${day.theme}`))
    lines.push(line(day.date))
    if (day.startTime || day.endTime) {
      lines.push(line(`Day window: ${[day.startTime, day.endTime].filter(Boolean).join(' - ')}`))
    }
    lines.push(line())

    for (const activity of day.activities) {
      const timeRange = activity.startTime || activity.endTime
        ? `${[activity.startTime, activity.endTime].filter(Boolean).join(' - ')}`
        : activity.time
      lines.push(line(`### ${timeRange}: ${activity.title}`))
      if (activity.durationMinutes) {
        lines.push(line(`Duration: ${activity.durationMinutes} minutes`))
      }
      if (activity.travelFromPrevious) {
        lines.push(line(`Travel from previous stop: ${activity.travelFromPrevious.durationMinutes} minutes by ${activity.travelFromPrevious.mode} - ${activity.travelFromPrevious.description}`))
      }
      if (activity.isFixedTime) {
        lines.push(line('Fixed-time activity: yes'))
      }
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
