import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'
import { createCalendarEvent, getCurrentUserId, getSupportedTimeZones, getUpcomingEvents, MS_GRAPH_SCOPES, MS_GRAPH_WRITE_SCOPES } from '../lib/graph'

const connect = vi.hoisted(() => ({
  getToken: vi.fn(), startAuthorization: vi.fn(),
  UserAuthorizationRequiredError: class extends Error {},
  ConnectorInstallationRequiredError: class extends Error {},
  NoValidTokenError: class extends Error {}, ConnectError: class extends Error {},
}))
vi.mock('@vercel/connect', () => connect)
const passport = (claims: unknown) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
const headers = (token = passport({ external_sub: 'trusted-user' })) => new Headers({
  'x-vercel-oidc-passport-token': token, host: 'calendar.example.com',
}) as ReadonlyHeaders
const input = {
  title: 'Focus', start: '2026-10-27T10:00', end: '2026-10-27T10:30',
  timeZone: 'America/New_York', isAllDay: false,
  transactionId: 'a05ac985-969b-4acc-90c9-96974ad7368d',
}
const zones = () => Response.json({ value: [{ alias: 'America/New_York', displayName: 'Eastern time' }, { alias: 'Asia/Tokyo' }] })
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  connect.getToken.mockReset().mockResolvedValue('server-only-token')
  connect.startAuthorization.mockReset().mockResolvedValue({ url: 'https://connect.vercel.com/authorize' })
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('Passport identity', () => {
  it.each(['', 'malformed', 'header.!!!.signature', passport(null), passport({}), passport({ external_sub: 123 }), passport({ external_sub: ' ' })])('fails safely for %s', (token) => {
    expect(getCurrentUserId(headers(token))).toEqual({ ok: false })
  })
  it('accepts a nonempty identity from the platform header', () => {
    expect(getCurrentUserId(headers())).toEqual({ ok: true, userId: 'trusted-user' })
  })
})

describe('Outlook actions', () => {
  it('requires an authenticated caller before requesting tokens or writing', async () => {
    expect((await createCalendarEvent(headers(''), input)).status).toBe('passport_missing')
    expect((await getSupportedTimeZones(headers(''))).status).toBe('passport_missing')
    expect(connect.getToken).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('rejects invalid fields before consent or a Graph request', async () => {
    expect((await createCalendarEvent(headers(), { ...input, title: '' })).status).toBe('validation_error')
    expect(connect.getToken).not.toHaveBeenCalled()
  })
  it('uses read scopes for time zones and filters malformed aliases', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ value: [{ alias: 'Asia/Tokyo' }, { alias: 'not/a-zone' }, { alias: 2 }, { alias: 'Asia/Tokyo' }] }))
    expect(await getSupportedTimeZones(headers())).toEqual({ status: 'success', timeZones: [{ id: 'Asia/Tokyo', label: 'Asia/Tokyo' }] })
    expect(connect.getToken).toHaveBeenCalledWith(expect.any(String), { subject: { type: 'user', id: 'trusted-user' }, scopes: MS_GRAPH_SCOPES })
  })
  it('requests write scopes and sends only the validated fields to the default calendar', async () => {
    fetchMock.mockResolvedValueOnce(zones()).mockResolvedValueOnce(Response.json({ id: 'created-id', webLink: 'https://outlook.office.com/event' }, { status: 201 }))
    const result = await createCalendarEvent(headers(), { ...input, userId: 'attacker', attendees: ['someone@example.com'] })
    expect(connect.getToken).toHaveBeenCalledWith(expect.any(String), { subject: { type: 'user', id: 'trusted-user' }, scopes: MS_GRAPH_WRITE_SCOPES })
    expect(result.status).toBe('success')
    const [url, options] = fetchMock.mock.calls[1]
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/events')
    expect(options?.method).toBe('POST')
    expect(options?.cache).toBe('no-store')
    const body = JSON.parse(options?.body as string)
    expect(body.transactionId).toBe(input.transactionId)
    expect(body).not.toHaveProperty('attendees')
    expect(body).not.toHaveProperty('userId')
    expect(result).not.toHaveProperty('token')
  })
  it('rejects a valid IANA zone that the mailbox does not support', async () => {
    fetchMock.mockResolvedValueOnce(zones())
    const result = await createCalendarEvent(headers(), { ...input, timeZone: 'Europe/London' })
    expect(result.status).toBe('validation_error')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('starts incremental authorization without attempting creation', async () => {
    connect.getToken.mockRejectedValueOnce(new connect.UserAuthorizationRequiredError())
    expect((await createCalendarEvent(headers(), input)).status).toBe('needs_authorization')
    expect(connect.startAuthorization).toHaveBeenCalledWith(expect.any(String), {
      subject: { type: 'user', id: 'trusted-user' }, scopes: MS_GRAPH_WRITE_SCOPES,
    }, { callbackUrl: 'https://calendar.example.com/?newEvent=1' })
    expect(fetchMock).not.toHaveBeenCalled()
    // Denying creation permission does not upgrade the agenda's requested scopes.
    connect.getToken.mockResolvedValueOnce('read-token')
    fetchMock.mockResolvedValueOnce(Response.json({ value: [] })).mockResolvedValueOnce(Response.json({ mail: 'me@example.com' }))
    expect((await getUpcomingEvents(headers())).status).toBe('connected')
    expect(connect.getToken.mock.calls[1][1].scopes).toEqual(MS_GRAPH_SCOPES)
  })
  it.each([401, 403])('recovers from Graph %s without retrying writes automatically', async (status) => {
    fetchMock.mockResolvedValueOnce(zones()).mockResolvedValueOnce(new Response('', { status }))
    const result = await createCalendarEvent(headers(), input)
    expect(result.status).toBe('needs_authorization')
    if (status === 403 && result.status === 'needs_authorization') expect(result.message).toMatch(/administrator/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('handles throttling as a confirmed failure', async () => {
    fetchMock.mockResolvedValueOnce(zones()).mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '30' } }))
    expect(await createCalendarEvent(headers(), input)).toMatchObject({ status: 'error', uncertain: false, message: expect.stringContaining('30 seconds') })
  })
  it('keeps failures before the write distinct from unknown write outcomes', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    expect(await createCalendarEvent(headers(), input)).toMatchObject({ status: 'error', uncertain: false })
    fetchMock.mockResolvedValueOnce(zones()).mockRejectedValueOnce(new Error('network'))
    expect(await createCalendarEvent(headers(), input)).toMatchObject({ status: 'error', uncertain: true })
  })
  it.each([500, 503, 408])('marks a write response %s as uncertain', async (status) => {
    fetchMock.mockResolvedValueOnce(zones()).mockResolvedValueOnce(new Response('', { status }))
    expect(await createCalendarEvent(headers(), input)).toMatchObject({ status: 'error', uncertain: true })
  })
  it('reuses transaction IDs when an interrupted write is retried', async () => {
    fetchMock.mockResolvedValueOnce(zones()).mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValueOnce(zones()).mockResolvedValueOnce(Response.json({ id: 'one-event' }, { status: 201 }))
    expect((await createCalendarEvent(headers(), input)).status).toBe('error')
    expect((await createCalendarEvent(headers(), input)).status).toBe('success')
    expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[3][1]?.body)
  })
  it('returns all-day dates separately from UTC instants', async () => {
    fetchMock.mockResolvedValueOnce(zones()).mockResolvedValueOnce(Response.json({ id: 'all-day' }, { status: 201 }))
    expect(await createCalendarEvent(headers(), { ...input, isAllDay: true, start: '2026-10-27', end: '2026-10-28' })).toMatchObject({
      status: 'success', event: { allDayStartDate: '2026-10-27', allDayEndDate: '2026-10-29', start: '2026-10-27T04:00:00Z' },
    })
  })
  it('preserves all-day date fields when reading the agenda', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ value: [{
      id: 'day-off', subject: 'Day off', isAllDay: true,
      start: { dateTime: '2026-10-27T00:00:00.0000000', timeZone: 'UTC' },
      end: { dateTime: '2026-10-28T00:00:00.0000000', timeZone: 'UTC' },
    }] })).mockResolvedValueOnce(Response.json({ mail: 'me@example.com' }))
    expect(await getUpcomingEvents(headers())).toMatchObject({ status: 'connected', events: [{
      allDayStartDate: '2026-10-27', allDayEndDate: '2026-10-28',
    }] })
  })
  it('does not report success for an unreadable creation response', async () => {
    fetchMock.mockResolvedValueOnce(zones()).mockResolvedValueOnce(Response.json({}))
    expect(await createCalendarEvent(headers(), input)).toMatchObject({ status: 'error', uncertain: true })
  })
})
