'use client'

import { useEffect, useState } from 'react'
import type { CalendarEvent } from '@/lib/calendar-types'
import { upcomingEvents } from '@/lib/time'
import { EmptyState } from './empty-state'
import { UpNextCard } from './up-next-card'
import { UpcomingList } from './upcoming-list'

export function CalendarAgenda({ events, account }: { events: CalendarEvent[]; account?: string | null }) {
  // Local calendar dates need the browser's timezone. This also avoids server /
  // browser hydration differences for "Today" labels and live countdowns.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  if (now === null) return <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading your agenda…</p>
  const [next, ...rest] = upcomingEvents(events, now)
  return next ? <><UpNextCard event={next} /><UpcomingList events={rest} /></> : <EmptyState account={account} />
}
