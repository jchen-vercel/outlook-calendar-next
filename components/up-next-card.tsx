"use client"

import { useEffect, useState } from "react"
import { Clock, MapPin, Video, Users, ExternalLink, CalendarClock } from "lucide-react"
import type { CalendarEvent } from "@/lib/calendar-types"
import { countdown, formatTimeRange, formatDayLabel, initials } from "@/lib/time"

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function UpNextCard({ event }: { event: CalendarEvent }) {
  const now = useNow(1000)
  const startMs = new Date(event.start).getTime()
  const endMs = new Date(event.end).getTime()
  const inProgress = now >= startMs && now <= endMs
  const cd = countdown(event.start, event.end, now)
  const visibleAttendees = event.attendees.slice(0, 5)
  const extra = event.attendees.length - visibleAttendees.length

  return (
    <section
      aria-labelledby="up-next-heading"
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span
          className={`inline-flex size-2 rounded-full ${inProgress ? "bg-primary animate-pulse" : "bg-primary/60"}`}
          aria-hidden="true"
        />
        <span id="up-next-heading">{inProgress ? "Happening now" : "Up next"}</span>
        <span className="text-muted-foreground/60">·</span>
        <span>{formatDayLabel(event.start)}</span>
      </div>

      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {event.subject}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {formatTimeRange(event.start, event.end, event.isAllDay)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" />
                <span className="max-w-[16rem] truncate">{event.location}</span>
              </span>
            )}
            {event.organizer && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" aria-hidden="true" />
                {event.organizer}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <div
            className="rounded-2xl bg-accent px-4 py-3 text-accent-foreground"
            role="timer"
            aria-live="polite"
          >
            <div className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">{cd}</div>
            <div className="text-xs font-medium uppercase tracking-wide opacity-80">
              {inProgress ? "remaining" : "until start"}
            </div>
          </div>
          {event.onlineMeetingUrl && (
            <a
              href={event.onlineMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              <Video className="size-4" aria-hidden="true" />
              Join meeting
            </a>
          )}
        </div>
      </div>

      {(visibleAttendees.length > 0 || event.webLink) && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
          {visibleAttendees.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {visibleAttendees.map((a) => (
                  <span
                    key={a.email}
                    title={`${a.name} (${a.status})`}
                    className="inline-flex size-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-semibold text-secondary-foreground"
                  >
                    {initials(a.name)}
                  </span>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {event.attendees.length} attendee{event.attendees.length > 1 ? "s" : ""}
                {extra > 0 ? ` · +${extra} more` : ""}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden="true" />
              No attendees
            </span>
          )}
          {event.webLink && (
            <a
              href={event.webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:opacity-80"
            >
              Open in Outlook
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </section>
  )
}
