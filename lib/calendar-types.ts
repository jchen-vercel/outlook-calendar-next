export type CalendarEvent = {
  id: string
  subject: string
  start: string // ISO string (UTC)
  end: string // ISO string (UTC)
  isAllDay: boolean
  /** Calendar dates, without timezone conversion. End is exclusive. */
  allDayStartDate?: string | null
  allDayEndDate?: string | null
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

export type CreateEventInput = {
  title: string
  /** Local datetime (YYYY-MM-DDTHH:mm), or date for all-day events. */
  start: string
  /** Inclusive end date for all-day events. */
  end: string
  timeZone: string
  isAllDay: boolean
  location?: string
  notes?: string
  transactionId: string
}

export type EventFieldErrors = Partial<Record<keyof CreateEventInput, string>>

export type CalendarActionFailure =
  | { status: 'validation_error'; fieldErrors: EventFieldErrors }
  | { status: 'needs_authorization'; authorizationUrl?: string; message: string }
  | { status: 'needs_setup' | 'passport_missing'; message: string }
  | { status: 'error'; message: string; uncertain: boolean }

export type CreatedEvent = Pick<CalendarEvent,
  'id' | 'subject' | 'start' | 'end' | 'isAllDay' | 'allDayStartDate' | 'allDayEndDate' | 'webLink'
>

export type CreateEventResult =
  | { status: 'success'; event: CreatedEvent }
  | CalendarActionFailure

export type TimeZoneOption = { id: string; label: string }
export type TimeZonesResult =
  | { status: 'success'; timeZones: TimeZoneOption[] }
  | CalendarActionFailure
