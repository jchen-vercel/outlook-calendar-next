import type { CalendarEvent, CreatedEvent } from './calendar-types'

/** Parse calendar dates as local dates, rather than midnight UTC. */
function localDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function eventTimeBounds(event: Pick<CreatedEvent, 'start' | 'end' | 'isAllDay' | 'allDayStartDate' | 'allDayEndDate'>) {
  return {
    start: event.isAllDay && event.allDayStartDate ? localDate(event.allDayStartDate).getTime() : new Date(event.start).getTime(),
    end: event.isAllDay && event.allDayEndDate ? localDate(event.allDayEndDate).getTime() : new Date(event.end).getTime(),
  }
}

export function upcomingEvents(events: CalendarEvent[], nowMs: number): CalendarEvent[] {
  return events.filter((event) => eventTimeBounds(event).end > nowMs)
    .sort((a, b) => eventTimeBounds(a).start - eventTimeBounds(b).start)
}

export function formatEventDayLabel(event: CalendarEvent): string {
  return formatDayLabel(event.isAllDay && event.allDayStartDate
    ? localDate(event.allDayStartDate).toISOString() : event.start)
}

export function formatEventTimeRange(event: CalendarEvent): string {
  if (!event.isAllDay || !event.allDayStartDate || !event.allDayEndDate) {
    return formatTimeRange(event.start, event.end, event.isAllDay)
  }
  const start = localDate(event.allDayStartDate)
  const last = localDate(event.allDayEndDate)
  last.setDate(last.getDate() - 1)
  if (start.getTime() === last.getTime()) return 'All day'
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `All day · ${start.toLocaleDateString([], options)} – ${last.toLocaleDateString([], options)}`
}

export function formatTimeRange(startIso: string, endIso: string, allDay: boolean): string {
  if (allDay) {
    return 'All day'
  }
  const start = new Date(startIso)
  const end = new Date(endIso)
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (sameDay(date, today)) {
    return 'Today'
  }
  if (sameDay(date, tomorrow)) {
    return 'Tomorrow'
  }
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

/** Human-friendly "in 12 min" / "in 2 hr 5 min" / "Now" / "Started 3 min ago". */
export function relativeStart(startIso: string, endIso: string, nowMs: number): string {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const diffMs = start - nowMs

  if (nowMs >= start && nowMs < end) {
    return 'In progress'
  }
  if (diffMs < 0) {
    return 'Started'
  }

  const totalMin = Math.round(diffMs / 60000)
  if (totalMin < 1) {
    return 'Starting now'
  }
  if (totalMin < 60) {
    return `in ${totalMin} min`
  }

  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours < 24) {
    return mins ? `in ${hours} hr ${mins} min` : `in ${hours} hr`
  }

  const days = Math.round(hours / 24)
  return `in ${days} day${days > 1 ? 's' : ''}`
}

/** Precise countdown like "01:23:45" while under 24h, otherwise day-based. */
export function countdown(startIso: string, endIso: string, nowMs: number): string {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()

  if (nowMs >= start && nowMs < end) {
    const remaining = end - nowMs
    return `${pad(Math.floor(remaining / 3600000))}:${pad(Math.floor((remaining % 3600000) / 60000))}:${pad(
      Math.floor((remaining % 60000) / 1000)
    )} left`
  }

  const diff = start - nowMs
  if (diff <= 0) return '00:00:00'
  if (diff > 24 * 3600000) {
    const days = Math.floor(diff / (24 * 3600000))
    const hrs = Math.floor((diff % (24 * 3600000)) / 3600000)
    return `${days}d ${hrs}h`
  }
  return `${pad(Math.floor(diff / 3600000))}:${pad(Math.floor((diff % 3600000) / 60000))}:${pad(
    Math.floor((diff % 60000) / 1000)
  )}`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export function groupByDay(events: CalendarEvent[]): { day: string; events: CalendarEvent[] }[] {
  const groups = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const key = formatEventDayLabel(e)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(e)
  }
  return Array.from(groups.entries()).map(([day, events]) => ({ day, events }))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
