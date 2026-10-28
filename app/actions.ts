'use server'

import { headers } from 'next/headers'
import { createCalendarEvent, getSupportedTimeZones } from '@/lib/graph'
import type { CreateEventInput, CreateEventResult, TimeZonesResult } from '@/lib/calendar-types'

export async function loadTimeZones(): Promise<TimeZonesResult> {
  return getSupportedTimeZones(await headers())
}

export async function createEvent(input: CreateEventInput): Promise<CreateEventResult> {
  return createCalendarEvent(await headers(), input)
}
