import {
  getToken,
  startAuthorization,
  UserAuthorizationRequiredError,
  ConnectorInstallationRequiredError,
  NoValidTokenError,
  ConnectError,
} from '@vercel/connect'

import type {
  CalendarEvent, CalendarResult, CalendarActionFailure, CreateEventResult,
  TimeZoneOption, TimeZonesResult,
} from './calendar-types'
import { validateEventInput } from './event-validation'
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'

/**
 * The Vercel Connect connector UID for Microsoft Graph.
 *
 * This connector must be created once (dashboard or CLI) as a Custom OAuth
 * connector pointing at Microsoft's OAuth endpoints, and attached to this
 * project. See the in-app setup card for the exact steps.
 *
 * You can override the UID with the MS_GRAPH_CONNECTOR env var.
 */
export const MS_GRAPH_CONNECTOR = process.env.MS_GRAPH_CONNECTOR ?? 'oauth/microsoft-graph'

/**
 * Microsoft Graph scopes needed to read the signed-in user's calendar.
 * `offline_access` lets Vercel Connect refresh the token for you.
 */
export const MS_GRAPH_SCOPES = ['openid', 'profile', 'offline_access', 'Calendars.Read', 'User.Read']
export const MS_GRAPH_WRITE_SCOPES = ['openid', 'profile', 'offline_access', 'Calendars.ReadWrite', 'User.Read']

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export function getCurrentUserId(headers: ReadonlyHeaders): { userId: string; ok: true } | { ok: false } {
  // Passport validates this header at Vercel's edge. Never take identity from form data.
  const token = headers.get('x-vercel-oidc-passport-token')
  if (!token) {
    return { ok: false }
  }
  try {
    if (token.split('.').length !== 3) return { ok: false }
    const payload: unknown = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    if (!payload || typeof payload !== 'object' || !('external_sub' in payload) ||
      typeof payload.external_sub !== 'string' || !payload.external_sub.trim()) return { ok: false }
    return { ok: true, userId: payload.external_sub }
  } catch {
    return { ok: false }
  }
}

/**
 * Derive the app's own origin from the incoming request headers so we can tell
 * Vercel Connect where to send the user back after they finish authorizing.
 * Without this, Connect has no return URL and the browser is left on the
 * connect.vercel.com callback instead of returning to the app.
 */
function getAppOrigin(headers: ReadonlyHeaders): string | undefined {
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!host) {
    return undefined
  }
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const proto = headers.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  return `${proto}://${host}`
}

type GraphEvent = {
  id: string
  subject?: string
  bodyPreview?: string
  isAllDay?: boolean
  isCancelled?: boolean
  webLink?: string
  start?: { dateTime: string; timeZone: string }
  end?: { dateTime: string; timeZone: string }
  location?: { displayName?: string }
  organizer?: { emailAddress?: { name?: string; address?: string } }
  onlineMeeting?: { joinUrl?: string }
  onlineMeetingUrl?: string
  responseStatus?: { response?: string }
  attendees?: {
    emailAddress?: { name?: string; address?: string }
    status?: { response?: string }
  }[]
}

function toIsoUtc(graphDateTime?: { dateTime: string; timeZone: string }): string {
  if (!graphDateTime?.dateTime) return new Date().toISOString()
  // Graph returns naive datetimes; when timeZone is UTC, append Z.
  const { dateTime, timeZone } = graphDateTime
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(dateTime)) return new Date(dateTime).toISOString()
  if (timeZone === 'UTC') return new Date(`${dateTime}Z`).toISOString()
  // Fallback: trust the value as-is.
  return new Date(`${dateTime}Z`).toISOString()
}

function mapEvent(e: GraphEvent): CalendarEvent {
  return {
    id: e.id,
    subject: e.subject?.trim() || '(No title)',
    start: toIsoUtc(e.start),
    end: toIsoUtc(e.end),
    isAllDay: Boolean(e.isAllDay),
    allDayStartDate: e.isAllDay ? e.start?.dateTime.slice(0, 10) ?? null : null,
    allDayEndDate: e.isAllDay ? e.end?.dateTime.slice(0, 10) ?? null : null,
    location: e.location?.displayName?.trim() || null,
    organizer: e.organizer?.emailAddress?.name || e.organizer?.emailAddress?.address || null,
    attendees: (e.attendees ?? [])
      .map((a) => ({
        name: a.emailAddress?.name || a.emailAddress?.address || 'Unknown',
        email: a.emailAddress?.address || '',
        status: a.status?.response || 'none',
      }))
      .filter((a) => a.email),
    onlineMeetingUrl: e.onlineMeeting?.joinUrl || e.onlineMeetingUrl || null,
    webLink: e.webLink || null,
    bodyPreview: e.bodyPreview?.trim() || null,
    isCancelled: Boolean(e.isCancelled),
    responseStatus: e.responseStatus?.response || null,
  }
}

/**
 * Acquire a short-lived Microsoft Graph access token through Vercel Connect.
 * Returns either a token, or a recoverable state the UI can act on.
 */
async function getGraphToken(
  userId: string,
  callbackUrl?: string,
  scopes = MS_GRAPH_SCOPES,
): Promise<
  | { ok: true; token: string }
  | { ok: false; status: 'needs_authorization'; authorizationUrl?: string }
  | { ok: false; status: 'needs_setup'; message: string }
  | { ok: false; status: 'error'; message: string }
> {
  try {
    const token = await getToken(MS_GRAPH_CONNECTOR, {
      subject: { type: 'user', id: userId },
      scopes,
    })
    return { ok: true, token }
  } catch (error) {
    // The user (or installation) has not consented yet — start the OAuth flow.
    if (
      error instanceof UserAuthorizationRequiredError ||
      error instanceof ConnectorInstallationRequiredError ||
      error instanceof NoValidTokenError
    ) {
      try {
        const { url } = await startAuthorization(
          MS_GRAPH_CONNECTOR,
          {
            subject: { type: 'user', id: userId },
            scopes,
          },
          // Send the user back to the app once Connect finishes the OAuth flow.
          callbackUrl ? { callbackUrl } : undefined
        )
        return { ok: false, status: 'needs_authorization', authorizationUrl: url }
      } catch {
        return { ok: false, status: 'needs_authorization' }
      }
    }

    // The connector doesn't exist or isn't linked to this project yet.
    if (
      error instanceof ConnectError &&
      (error.code === 'connector_not_found' ||
        error.code === 'client_not_linked_to_project' ||
        error.code === 'client_not_enabled_for_environment' ||
        error.status === 404)
    ) {
      return {
        ok: false,
        status: 'needs_setup',
        message:
          "The Microsoft Graph connector isn't set up for this project yet. Create it in Vercel Connect and attach it to this project.",
      }
    }

    // Missing OIDC token locally is the most common dev-time failure.
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (/oidc|VERCEL_OIDC_TOKEN|unauthorized|401/i.test(message)) {
      return {
        ok: false,
        status: 'needs_setup',
        message:
          "Couldn't authenticate to Vercel Connect. Run `vercel link` and `vercel env pull` locally, or deploy to Vercel where the OIDC token is injected automatically.",
      }
    }

    return { ok: false, status: 'error', message: 'Could not obtain Outlook access. Please try again.' }
  }
}

async function graphFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Return all times normalized to UTC.
      'Prefer': 'outlook.timezone="UTC"',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
}

/**
 * Fetch the user's upcoming events from now through the next 14 days using the
 * Microsoft Graph calendarView endpoint (expands recurring events).
 */
export async function getUpcomingEvents(headers: ReadonlyHeaders): Promise<CalendarResult> {
  const userIdResult = getCurrentUserId(headers)
  if (!userIdResult.ok) {
    return {
      status: 'passport_missing',
      events: [],
    }
  }
  const userId = userIdResult.userId
  const callbackUrl = getAppOrigin(headers)
  const tokenResult = await getGraphToken(userId, callbackUrl)

  if (!tokenResult.ok) {
    return {
      status: tokenResult.status,
      events: [],
      authorizationUrl: tokenResult.status === 'needs_authorization' ? tokenResult.authorizationUrl : undefined,
      message: 'message' in tokenResult ? tokenResult.message : undefined,
    }
  }

  const token = tokenResult.token
  const now = new Date()
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: end.toISOString(),
    $orderby: 'start/dateTime',
    $top: '100',
    $select:
      'id,subject,bodyPreview,start,end,isAllDay,isCancelled,location,organizer,attendees,onlineMeeting,onlineMeetingUrl,webLink,responseStatus',
  })

  try {
    const [eventsRes, meRes] = await Promise.all([
      graphFetch(token, `/me/calendarView?${params.toString()}`),
      graphFetch(token, `/me?$select=displayName,mail,userPrincipalName`),
    ])

    if (!eventsRes.ok) {
      if (eventsRes.status === 401 || eventsRes.status === 403) {
        const { url } = await startAuthorization(
          MS_GRAPH_CONNECTOR,
          {
            subject: { type: 'user', id: userId },
            scopes: MS_GRAPH_SCOPES,
          },
          callbackUrl ? { callbackUrl } : undefined
        ).catch(() => ({ url: undefined }))
        return { status: 'needs_authorization', events: [], authorizationUrl: url }
      }
      const text = await eventsRes.text().catch(() => '')
      return {
        status: 'error',
        events: [],
        message: `Microsoft Graph returned ${eventsRes.status}. ${text.slice(0, 300)}`,
      }
    }

    const data = (await eventsRes.json()) as { value?: GraphEvent[] }
    const me = meRes.ok
      ? ((await meRes.json()) as { displayName?: string; mail?: string; userPrincipalName?: string })
      : null

    const events = (data.value ?? [])
      .filter((e) => !e.isCancelled)
      .map(mapEvent)
      // Only keep events that haven't ended yet.
      // All-day dates are filtered in the browser's calendar timezone, not the server's.
      .filter((e) => e.isAllDay || new Date(e.end).getTime() > now.getTime())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return {
      status: 'connected',
      events,
      account: me?.mail || me?.userPrincipalName || me?.displayName || null,
    }
  } catch (error) {
    return {
      status: 'error',
      events: [],
      message: error instanceof Error ? error.message : 'Failed to reach Microsoft Graph.',
    }
  }
}

function tokenFailure(result: Exclude<Awaited<ReturnType<typeof getGraphToken>>, { ok: true }>): CalendarActionFailure {
  if (result.status === 'needs_authorization') {
    return { status: result.status, authorizationUrl: result.authorizationUrl,
      message: 'Authorize Outlook access, then return here and save your event.' }
  }
  if (result.status === 'error') return { status: 'error', message: result.message, uncertain: false }
  return { status: result.status, message: result.message }
}

async function authorizationFailure(userId: string, callbackUrl: string | undefined, scopes: string[], forbidden = false): Promise<CalendarActionFailure> {
  const { url } = await startAuthorization(MS_GRAPH_CONNECTOR, {
    subject: { type: 'user', id: userId }, scopes,
  }, callbackUrl ? { callbackUrl } : undefined).catch(() => ({ url: undefined }))
  return {
    status: 'needs_authorization', authorizationUrl: url,
    message: forbidden
      ? 'Outlook denied access. Reconnect with calendar permission. If this persists, your organization may require administrator approval.'
      : 'Enable calendar creation in Outlook, then return here and save your event.',
  }
}

class GraphResponseError extends Error {
  constructor(public response: Response) { super(`Microsoft Graph returned ${response.status}`) }
}

async function readTimeZones(token: string): Promise<TimeZoneOption[]> {
  const response = await graphFetch(token, "/me/outlook/supportedTimeZones(TimeZoneStandard=microsoft.graph.timeZoneStandard'Iana')")
  if (!response.ok) throw new GraphResponseError(response)
  const data = await response.json() as { value?: { alias?: unknown; displayName?: unknown }[] }
  const zones = new Map<string, TimeZoneOption>()
  for (const zone of data.value ?? []) {
    if (typeof zone.alias !== 'string') continue
    try {
      // Only expose zones that both Graph and this runtime understand.
      new Intl.DateTimeFormat('en', { timeZone: zone.alias })
      zones.set(zone.alias, { id: zone.alias, label: typeof zone.displayName === 'string' ? zone.displayName : zone.alias })
    } catch { /* Ignore unsupported legacy aliases. */ }
  }
  if (!zones.size) throw new Error('No supported time zones')
  return [...zones.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function graphError(response: Response, uncertain: boolean): CalendarActionFailure {
  if (response.status === 429) {
    const seconds = Number(response.headers.get('retry-after'))
    return { status: 'error', uncertain: false,
      message: `Outlook is receiving too many requests. ${seconds > 0 ? `Wait ${seconds} seconds` : 'Wait a moment'} before retrying.` }
  }
  return { status: 'error', uncertain,
    message: uncertain
      ? 'Outlook could not confirm whether the event was saved. Retry this same request to avoid creating a duplicate.'
      : 'Outlook could not complete this request. Your draft is unchanged. Please try again.' }
}

export async function getSupportedTimeZones(headers: ReadonlyHeaders): Promise<TimeZonesResult> {
  const identity = getCurrentUserId(headers)
  if (!identity.ok) return { status: 'passport_missing', message: 'Sign in to load Outlook time zones.' }
  const origin = getAppOrigin(headers)
  const callbackUrl = origin ? `${origin}/?newEvent=1` : undefined
  const token = await getGraphToken(identity.userId, callbackUrl)
  if (!token.ok) return tokenFailure(token)
  try {
    return { status: 'success', timeZones: await readTimeZones(token.token) }
  } catch (error) {
    if (error instanceof GraphResponseError) {
      if ([401, 403].includes(error.response.status)) {
        return authorizationFailure(identity.userId, callbackUrl, MS_GRAPH_SCOPES, error.response.status === 403)
      }
      return graphError(error.response, false)
    }
    return { status: 'error', uncertain: false, message: 'Could not load Outlook time zones. Please retry.' }
  }
}

export async function createCalendarEvent(headers: ReadonlyHeaders, input: unknown): Promise<CreateEventResult> {
  const identity = getCurrentUserId(headers)
  if (!identity.ok) return { status: 'passport_missing', message: 'Sign in before creating an event.' }
  const validation = validateEventInput(input)
  if (!validation.ok) return { status: 'validation_error', fieldErrors: validation.fieldErrors }
  const value = validation.value
  const origin = getAppOrigin(headers)
  const callbackUrl = origin ? `${origin}/?newEvent=1` : undefined
  const token = await getGraphToken(identity.userId, callbackUrl, MS_GRAPH_WRITE_SCOPES)
  if (!token.ok) return tokenFailure(token)

  // Validate against this mailbox's supported zones before any write.
  try {
    const zones = await readTimeZones(token.token)
    if (!zones.some((zone) => zone.id === value.input.timeZone)) {
      return { status: 'validation_error', fieldErrors: { timeZone: 'Choose a time zone supported by your Outlook mailbox.' } }
    }
  } catch (error) {
    if (error instanceof GraphResponseError) {
      if ([401, 403].includes(error.response.status)) {
        return authorizationFailure(identity.userId, callbackUrl, MS_GRAPH_WRITE_SCOPES, error.response.status === 403)
      }
      return graphError(error.response, false)
    }
    return { status: 'error', uncertain: false, message: 'Could not verify the time zone. Your event has not been sent. Please retry.' }
  }

  try {
    const response = await graphFetch(token.token, '/me/events', {
      method: 'POST', body: JSON.stringify(value.graphBody),
    })
    if ([401, 403].includes(response.status)) {
      return authorizationFailure(identity.userId, callbackUrl, MS_GRAPH_WRITE_SCOPES, response.status === 403)
    }
    if (!response.ok) return graphError(response, response.status >= 500 || response.status === 408)
    const event = await response.json() as { id?: string; webLink?: string }
    if (typeof event.id !== 'string' || !event.id) throw new Error('Missing event ID')
    const webLink = typeof event.webLink === 'string' && event.webLink.startsWith('https://') ? event.webLink : null
    return { status: 'success', event: {
      id: event.id, subject: value.input.title, start: value.startUtc, end: value.endUtc,
      isAllDay: value.input.isAllDay, webLink,
      allDayStartDate: value.input.isAllDay ? value.input.start : null,
      allDayEndDate: value.input.isAllDay ? value.graphBody.end.dateTime.slice(0, 10) : null,
    } }
  } catch {
    return { status: 'error', uncertain: true,
      message: 'The connection was interrupted and the save status is unknown. Retry this same request to avoid creating a duplicate.' }
  }
}
