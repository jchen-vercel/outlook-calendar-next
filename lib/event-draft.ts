import type { CreateEventInput } from './calendar-types'

export type SavedEventDraft = { version: 1; input: CreateEventInput; uncertain: boolean }

export function newEventDraft(now = new Date()): CreateEventInput {
  const start = new Date(now)
  start.setSeconds(0, 0)
  start.setMinutes(Math.floor(start.getMinutes() / 30) * 30 + 30)
  const end = new Date(start.getTime() + 30 * 60000)
  const local = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return {
    title: '', start: local(start), end: local(end),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isAllDay: false, location: '', notes: '', transactionId: crypto.randomUUID(),
  }
}

export function parseSavedDraft(raw: string | null): SavedEventDraft | null {
  try {
    const data = JSON.parse(raw ?? 'null') as SavedEventDraft | null
    const input = data?.input
    if (data?.version !== 1 || typeof data.uncertain !== 'boolean' || !input ||
      typeof input.isAllDay !== 'boolean' ||
      !['title', 'start', 'end', 'timeZone', 'transactionId'].every((key) =>
        typeof input[key as keyof CreateEventInput] === 'string') ||
      (input.location !== undefined && typeof input.location !== 'string') ||
      (input.notes !== undefined && typeof input.notes !== 'string')) return null
    return data
  } catch {
    return null
  }
}
