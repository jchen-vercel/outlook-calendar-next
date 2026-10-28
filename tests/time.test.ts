import { afterEach, describe, expect, it, vi } from 'vitest'
import { eventTimeBounds, formatEventDayLabel, formatEventTimeRange, groupByDay, upcomingEvents } from '../lib/time'
import { newEventDraft, parseSavedDraft } from '../lib/event-draft'
import type { CalendarEvent } from '../lib/calendar-types'

const allDay: CalendarEvent = {
  id: 'all-day', subject: 'Day off', start: '2026-10-27T00:00:00Z', end: '2026-10-28T00:00:00Z',
  isAllDay: true, allDayStartDate: '2026-10-27', allDayEndDate: '2026-10-28',
  location: null, organizer: null, attendees: [], onlineMeetingUrl: null, webLink: null,
  bodyPreview: null, isCancelled: false, responseStatus: null,
}
afterEach(() => vi.useRealTimers())

describe('all-day calendar dates', () => {
  it('keeps labels and filtering on the selected calendar date', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 9, 27, 23, 30))
    expect(formatEventDayLabel(allDay)).toBe('Today')
    expect(groupByDay([allDay])[0].day).toBe('Today')
    expect(upcomingEvents([allDay], Date.now())).toHaveLength(1)
    expect(upcomingEvents([allDay], new Date(2026, 9, 28).getTime())).toHaveLength(0)
    expect(eventTimeBounds(allDay).start).toBe(new Date(2026, 9, 27).getTime())
  })
  it('formats inclusive multi-day spans', () => {
    expect(formatEventTimeRange(allDay)).toBe('All day')
    expect(formatEventTimeRange({ ...allDay, allDayEndDate: '2026-10-30' })).toMatch(/Oct 27.*Oct 29/)
  })
  it('sorts all-day events using local midnight alongside timed events', () => {
    const timed = { ...allDay, id: 'timed', isAllDay: false, start: new Date(2026, 9, 27, 9).toISOString(), end: new Date(2026, 9, 27, 10).toISOString() }
    expect(upcomingEvents([timed, allDay], new Date(2026, 9, 27).getTime()).map((e) => e.id)).toEqual(['all-day', 'timed'])
  })
})

describe('drafts', () => {
  it('defaults to the next half hour for 30 minutes, including midnight rollover', () => {
    const draft = newEventDraft(new Date(2026, 9, 27, 23, 45, 10))
    expect(draft.start).toBe('2026-10-28T00:00')
    expect(draft.end).toBe('2026-10-28T00:30')
    expect(draft.timeZone).toBeTruthy()
  })
  it('preserves the original request and uncertainty through storage', () => {
    const saved = { version: 1, input: newEventDraft(), uncertain: true }
    expect(parseSavedDraft(JSON.stringify(saved))).toEqual(saved)
  })
  it.each([null, '{bad', '{}', '{"version":2}', '{"version":1,"input":{"isAllDay":true},"uncertain":false}'])('ignores invalid stored drafts %s', (raw) => {
    expect(parseSavedDraft(raw)).toBeNull()
  })
})
