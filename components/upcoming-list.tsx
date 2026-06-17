"use client"

import { useEffect, useState } from "react"
import { Clock, MapPin, Video } from "lucide-react"
import type { CalendarEvent } from "@/lib/calendar-types"
import { formatTimeRange, relativeStart, groupByDay } from "@/lib/time"

function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function UpcomingList({ events }: { events: CalendarEvent[] }) {
  const now = useNow(30000)

  if (events.length === 0) return null
  const groups = groupByDay(events)

  return (
    <section aria-labelledby="later-heading" className="mt-10">
      <h3 id="later-heading" className="px-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Later
      </h3>
      <div className="mt-3 space-y-6">
        {groups.map((group) => (
          <div key={group.day}>
            <p className="px-1 pb-2 text-xs font-medium text-muted-foreground/80">{group.day}</p>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {group.events.map((event, idx) => (
                <li
                  key={event.id}
                  className={`flex items-center gap-4 px-4 py-3.5 sm:px-5 ${
                    idx !== 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {event.isAllDay
                      ? "All day"
                      : new Date(event.start).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{event.subject}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatTimeRange(event.start, event.end, event.isAllDay)}
                      </span>
                      {event.location && (
                        <span className="inline-flex max-w-[14rem] items-center gap-1 truncate">
                          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{event.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs font-medium text-muted-foreground sm:block">
                    {relativeStart(event.start, event.end, now)}
                  </div>
                  {event.onlineMeetingUrl && (
                    <a
                      href={event.onlineMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors hover:opacity-80"
                      aria-label={`Join ${event.subject}`}
                    >
                      <Video className="size-4" aria-hidden="true" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
