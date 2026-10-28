import { describe, expect, it } from 'vitest'
import { validateEventInput } from '../lib/event-validation'
import type { CreateEventInput } from '../lib/calendar-types'

const input: CreateEventInput = {
  title: ' Focus time ', start: '2026-10-27T10:00', end: '2026-10-27T10:30',
  timeZone: 'America/New_York', isAllDay: false,
  transactionId: 'a05ac985-969b-4acc-90c9-96974ad7368d',
}

describe('event validation and Graph payloads', () => {
  it('uses the selected zone, trims text, and sends plain-text notes without invitations', () => {
    const result = validateEventInput({ ...input, location: ' Home ', notes: '<b>Not HTML</b>' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.startUtc).toBe('2026-10-27T14:00:00Z')
    expect(result.value.graphBody).toEqual({
      subject: 'Focus time', start: { dateTime: '2026-10-27T10:00:00', timeZone: input.timeZone },
      end: { dateTime: '2026-10-27T10:30:00', timeZone: input.timeZone },
      isAllDay: false, showAs: 'busy', sensitivity: 'normal', transactionId: input.transactionId,
      location: { displayName: 'Home' }, body: { contentType: 'text', content: '<b>Not HTML</b>' },
    })
    expect(result.value.graphBody).not.toHaveProperty('attendees')
    expect(result.value.graphBody).not.toHaveProperty('isOnlineMeeting')
  })

  it('supports overnight events and changes the instant when the zone changes', () => {
    const result = validateEventInput({ ...input, start: '2026-10-27T23:30', end: '2026-10-28T01:00', timeZone: 'Asia/Tokyo' })
    expect(result.ok && result.value.startUtc).toBe('2026-10-27T14:30:00Z')
    expect(result.ok && result.value.endUtc).toBe('2026-10-27T16:00:00Z')
  })

  it.each([
    ['single-day', '2026-10-27', '2026-10-27', '2026-10-28T00:00:00'],
    ['multi-day across DST', '2026-03-07', '2026-03-09', '2026-03-10T00:00:00'],
  ])('creates %s all-day events with an exclusive local midnight end', (_, start, end, graphEnd) => {
    const result = validateEventInput({ ...input, isAllDay: true, start, end })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.graphBody.start.dateTime).toBe(`${start}T00:00:00`)
    expect(result.value.graphBody.end.dateTime).toBe(graphEnd)
    expect(result.value.graphBody.end.timeZone).toBe(input.timeZone)
    if (start === '2026-03-07') {
      expect((Date.parse(result.value.endUtc) - Date.parse(result.value.startUtc)) / 3600000).toBe(71)
    }
  })

  it.each([
    [{ title: '   ' }, 'title'],
    [{ end: input.start }, 'end'],
    [{ start: '2026-02-30T10:00' }, 'start'],
    [{ start: '2026-10-27T24:30' }, 'start'],
    [{ start: '2026-10-27T10:00Z' }, 'start'],
    [{ timeZone: 'invented/zone' }, 'timeZone'],
    [{ timeZone: '+01:00' }, 'timeZone'],
    [{ transactionId: 'bad' }, 'transactionId'],
    [{ isAllDay: 'true' }, 'isAllDay'],
    [{ title: 'x'.repeat(256) }, 'title'],
    [{ notes: 123 }, 'notes'],
    [{ isAllDay: true, start: '2026-10-28', end: '2026-10-27' }, 'end'],
  ])('rejects invalid input %j', (patch, field) => {
    const result = validateEventInput({ ...input, ...patch })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors).toHaveProperty(field)
  })

  it.each(['2026-03-08T02:30', '2026-11-01T01:30'])('rejects skipped or ambiguous DST time %s', (start) => {
    const result = validateEventInput({ ...input, start, end: `${start.slice(0, 10)}T04:00` })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.start).toMatch(/clocks change/)
  })

  it.each([null, [], 'untrusted'])('rejects malformed input %j', (value) => {
    expect(validateEventInput(value).ok).toBe(false)
  })
})
