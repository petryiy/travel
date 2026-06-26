export function getInclusiveTripDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []

  const dates: string[] = []
  for (let cursor = start; cursor <= end && dates.length < 366; cursor = new Date(cursor.getTime() + 86_400_000)) {
    dates.push(cursor.toISOString().slice(0, 10))
  }
  return dates
}

export function getInclusiveTripDayCount(startDate: string, endDate: string) {
  return getInclusiveTripDates(startDate, endDate).length
}
