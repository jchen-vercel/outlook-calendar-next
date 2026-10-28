import { Temporal } from '@js-temporal/polyfill'
import type { CreateEventInput, EventFieldErrors } from './calendar-types'

export type ValidatedEvent = {
  input: CreateEventInput
  startUtc: string
  endUtc: string
  graphBody: {
    subject: string
    start: { dateTime: string; timeZone: string }
    end: { dateTime: string; timeZone: string }
    isAllDay: boolean
    transactionId: string
    showAs: 'busy'
    sensitivity: 'normal'
    location?: { displayName: string }
    body?: { contentType: 'text'; content: string }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateEventInput(value: unknown):
  | { ok: true; value: ValidatedEvent }
  | { ok: false; fieldErrors: EventFieldErrors } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, fieldErrors: { title: 'Enter an event title.' } }
  }
  const raw = value as Record<string, unknown>
  const errors: EventFieldErrors = {}
  const text = (key: 'title' | 'location' | 'notes', max: number) => {
    if (raw[key] === undefined && key !== 'title') return ''
    if (typeof raw[key] !== 'string') {
      errors[key] = `Enter valid ${key === 'title' ? 'title' : key} text.`
      return ''
    }
    const result = raw[key].trim()
    if (result.length > max) errors[key] = `Use ${max} characters or fewer.`
    return result
  }
  const title = text('title', 255)
  const location = text('location', 255)
  const notes = text('notes', 10000)
  if (!title) errors.title = 'Enter an event title.'
  if (typeof raw.isAllDay !== 'boolean') errors.isAllDay = 'Choose an event type.'
  if (typeof raw.transactionId !== 'string' || !UUID.test(raw.transactionId)) {
    errors.transactionId = 'Reopen the form to start a new event.'
  }
  const zone = typeof raw.timeZone === 'string' ? raw.timeZone : ''
  try {
    // Reject offset-only zones; the picker uses mailbox-supported IANA names.
    if (!zone || /^[+-]/.test(zone)) throw new Error('Invalid zone')
    Temporal.Now.zonedDateTimeISO(zone)
  } catch {
    errors.timeZone = 'Choose a supported time zone.'
  }

  const isAllDay = raw.isAllDay === true
  function parseDate(key: 'start' | 'end') {
    const input = raw[key]
    const pattern = isAllDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    if (typeof input !== 'string' || !pattern.test(input)) {
      errors[key] = `Enter a valid ${isAllDay ? 'date' : 'date and time'}.`
      return null
    }
    try {
      if (isAllDay) {
        const date = Temporal.PlainDate.from(input, { overflow: 'reject' })
        return (key === 'end' ? date.add({ days: 1 }) : date).toPlainDateTime()
      }
      return Temporal.PlainDateTime.from(input, { overflow: 'reject' })
    } catch {
      errors[key] = `Enter a valid ${isAllDay ? 'date' : 'date and time'}.`
      return null
    }
  }
  const start = parseDate('start')
  const end = parseDate('end')
  const zoned = (date: Temporal.PlainDateTime | null, key: 'start' | 'end') => {
    if (!date || errors.timeZone) return null
    try {
      return date.toZonedDateTime(zone, { disambiguation: 'reject' })
    } catch {
      errors[key] = 'This time is skipped or occurs twice when the clocks change. Choose another time.'
      return null
    }
  }
  const startZoned = zoned(start, 'start')
  const endZoned = zoned(end, 'end')
  if (startZoned && endZoned && Temporal.ZonedDateTime.compare(endZoned, startZoned) <= 0) {
    errors.end = isAllDay ? 'End date must be on or after the start date.' : 'End must be after the start.'
  }
  if (Object.keys(errors).length || !start || !end || !startZoned || !endZoned) {
    return { ok: false, fieldErrors: errors }
  }
  const input: CreateEventInput = {
    title, location, notes, start: raw.start as string, end: raw.end as string,
    timeZone: zone, isAllDay, transactionId: raw.transactionId as string,
  }
  return {
    ok: true,
    value: {
      input,
      startUtc: startZoned.toInstant().toString(),
      endUtc: endZoned.toInstant().toString(),
      graphBody: {
        subject: title,
        start: { dateTime: start.toString({ smallestUnit: 'second' }), timeZone: zone },
        end: { dateTime: end.toString({ smallestUnit: 'second' }), timeZone: zone },
        isAllDay,
        transactionId: input.transactionId,
        showAs: 'busy',
        sensitivity: 'normal',
        ...(location ? { location: { displayName: location } } : {}),
        ...(notes ? { body: { contentType: 'text', content: notes } } : {}),
      },
    },
  }
}
