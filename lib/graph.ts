import {
  getToken,
  startAuthorization,
  UserAuthorizationRequiredError,
  ConnectorInstallationRequiredError,
  NoValidTokenError,
  ConnectError,
} from "@vercel/connect"

import type { CalendarEvent, CalendarResult } from "./calendar-types"

/**
 * The Vercel Connect connector UID for Microsoft Graph.
 *
 * This connector must be created once (dashboard or CLI) as a Custom OAuth
 * connector pointing at Microsoft's OAuth endpoints, and attached to this
 * project. See the in-app setup card for the exact steps.
 *
 * You can override the UID with the MS_GRAPH_CONNECTOR env var.
 */
export const MS_GRAPH_CONNECTOR = process.env.MS_GRAPH_CONNECTOR ?? "oauth/microsoft-graph"

/**
 * Microsoft Graph scopes needed to read the signed-in user's calendar.
 * `offline_access` lets Vercel Connect refresh the token for you.
 */
export const MS_GRAPH_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "Calendars.Read",
  "User.Read",
]

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

/**
 * In a real multi-user app, this comes from your auth session. For this
 * single-user demo we use a stable subject id so the consent grant persists
 * across requests.
 */
export function getCurrentUserId(): string {
  return process.env.DEMO_USER_ID ?? "outlook-demo-user"
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
  if (timeZone === "UTC") return new Date(`${dateTime}Z`).toISOString()
  // Fallback: trust the value as-is.
  return new Date(`${dateTime}Z`).toISOString()
}

function mapEvent(e: GraphEvent): CalendarEvent {
  return {
    id: e.id,
    subject: e.subject?.trim() || "(No title)",
    start: toIsoUtc(e.start),
    end: toIsoUtc(e.end),
    isAllDay: Boolean(e.isAllDay),
    location: e.location?.displayName?.trim() || null,
    organizer: e.organizer?.emailAddress?.name || e.organizer?.emailAddress?.address || null,
    attendees: (e.attendees ?? [])
      .map((a) => ({
        name: a.emailAddress?.name || a.emailAddress?.address || "Unknown",
        email: a.emailAddress?.address || "",
        status: a.status?.response || "none",
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
async function getGraphToken(userId: string): Promise<
  | { ok: true; token: string }
  | { ok: false; status: "needs_authorization"; authorizationUrl?: string }
  | { ok: false; status: "needs_setup"; message: string }
  | { ok: false; status: "error"; message: string }
> {
  try {
    const token = await getToken(MS_GRAPH_CONNECTOR, {
      subject: { type: "user", id: userId },
      scopes: MS_GRAPH_SCOPES,
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
        const { url } = await startAuthorization(MS_GRAPH_CONNECTOR, {
          subject: { type: "user", id: userId },
          scopes: MS_GRAPH_SCOPES,
        })
        return { ok: false, status: "needs_authorization", authorizationUrl: url }
      } catch {
        return { ok: false, status: "needs_authorization" }
      }
    }

    // The connector doesn't exist or isn't linked to this project yet.
    if (
      error instanceof ConnectError &&
      (error.code === "connector_not_found" ||
        error.code === "client_not_linked_to_project" ||
        error.code === "client_not_enabled_for_environment" ||
        error.status === 404)
    ) {
      return {
        ok: false,
        status: "needs_setup",
        message:
          "The Microsoft Graph connector isn't set up for this project yet. Create it in Vercel Connect and attach it to this project.",
      }
    }

    // Missing OIDC token locally is the most common dev-time failure.
    const message = error instanceof Error ? error.message : "Unknown error"
    if (/oidc|VERCEL_OIDC_TOKEN|unauthorized|401/i.test(message)) {
      return {
        ok: false,
        status: "needs_setup",
        message:
          "Couldn't authenticate to Vercel Connect. Run `vercel link` and `vercel env pull` locally, or deploy to Vercel where the OIDC token is injected automatically.",
      }
    }

    return { ok: false, status: "error", message }
  }
}

async function graphFetch(token: string, path: string): Promise<Response> {
  return fetch(`${GRAPH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Return all times normalized to UTC.
      Prefer: 'outlook.timezone="UTC"',
    },
    cache: "no-store",
  })
}

/**
 * Fetch the user's upcoming events from now through the next 14 days using the
 * Microsoft Graph calendarView endpoint (expands recurring events).
 */
export async function getUpcomingEvents(): Promise<CalendarResult> {
  const userId = getCurrentUserId()
  const tokenResult = await getGraphToken(userId)

  if (!tokenResult.ok) {
    return {
      status: tokenResult.status,
      events: [],
      authorizationUrl:
        tokenResult.status === "needs_authorization" ? tokenResult.authorizationUrl : undefined,
      message: "message" in tokenResult ? tokenResult.message : undefined,
    }
  }

  const token = tokenResult.token
  const now = new Date()
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: end.toISOString(),
    $orderby: "start/dateTime",
    $top: "100",
    $select:
      "id,subject,bodyPreview,start,end,isAllDay,isCancelled,location,organizer,attendees,onlineMeeting,onlineMeetingUrl,webLink,responseStatus",
  })

  try {
    const [eventsRes, meRes] = await Promise.all([
      graphFetch(token, `/me/calendarView?${params.toString()}`),
      graphFetch(token, `/me?$select=displayName,mail,userPrincipalName`),
    ])

    if (!eventsRes.ok) {
      if (eventsRes.status === 401 || eventsRes.status === 403) {
        const { url } = await startAuthorization(MS_GRAPH_CONNECTOR, {
          subject: { type: "user", id: userId },
          scopes: MS_GRAPH_SCOPES,
        }).catch(() => ({ url: undefined }))
        return { status: "needs_authorization", events: [], authorizationUrl: url }
      }
      const text = await eventsRes.text().catch(() => "")
      return {
        status: "error",
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
      .filter((e) => new Date(e.end).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return {
      status: "connected",
      events,
      account: me?.mail || me?.userPrincipalName || me?.displayName || null,
    }
  } catch (error) {
    return {
      status: "error",
      events: [],
      message: error instanceof Error ? error.message : "Failed to reach Microsoft Graph.",
    }
  }
}

/** Returns a fresh consent URL for the current user. */
export async function getAuthorizationUrl(): Promise<string | null> {
  try {
    const { url } = await startAuthorization(MS_GRAPH_CONNECTOR, {
      subject: { type: "user", id: getCurrentUserId() },
      scopes: MS_GRAPH_SCOPES,
    })
    return url
  } catch {
    return null
  }
}
