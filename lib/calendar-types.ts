export type CalendarEvent = {
  id: string
  subject: string
  start: string // ISO string (UTC)
  end: string // ISO string (UTC)
  isAllDay: boolean
  location: string | null
  organizer: string | null
  attendees: { name: string; email: string; status: string }[]
  onlineMeetingUrl: string | null
  webLink: string | null
  bodyPreview: string | null
  isCancelled: boolean
  responseStatus: string | null
}

export type CalendarStatus =
  | "connected" // events fetched successfully
  | "needs_authorization" // connector exists, user must consent
  | "needs_setup" // connector not created/linked yet
  | "passport_missing" // Vercel Passport not enabled for the project
  | "error"

export type CalendarResult = {
  status: CalendarStatus
  events: CalendarEvent[]
  authorizationUrl?: string
  message?: string
  /** The user's mailbox display name / email, when available. */
  account?: string | null
}
