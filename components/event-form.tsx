'use client'

import { useId, type RefObject } from 'react'
import type { CreateEventInput, EventFieldErrors, TimeZoneOption } from '@/lib/calendar-types'

const controlClass = 'mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60 aria-invalid:border-destructive'

type Props = {
  input: CreateEventInput
  errors: EventFieldErrors
  timeZones: TimeZoneOption[]
  loadingZones: boolean
  disabled: boolean
  titleRef: RefObject<HTMLInputElement | null>
  onChange: (patch: Partial<CreateEventInput>) => void
}

export function EventForm({ input, errors, timeZones, loadingZones, disabled, titleRef, onChange }: Props) {
  const prefix = useId()
  const attributes = (field: keyof CreateEventInput) => ({
    id: `${prefix}-${field}`,
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${prefix}-${field}-error` : undefined,
  })
  const error = (field: keyof CreateEventInput) => errors[field] ? (
    <p id={`${prefix}-${field}-error`} className="mt-1.5 text-sm text-destructive">{errors[field]}</p>
  ) : null

  function toggleAllDay(isAllDay: boolean) {
    onChange({
      isAllDay,
      start: isAllDay ? input.start.slice(0, 10) : `${input.start.slice(0, 10)}T09:00`,
      end: isAllDay ? input.end.slice(0, 10) : `${input.end.slice(0, 10)}T09:30`,
    })
  }

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <div>
        <label htmlFor={`${prefix}-title`} className="text-sm font-medium">Title <span className="text-muted-foreground">(required)</span></label>
        <input {...attributes('title')} ref={titleRef} name="title" type="text" required maxLength={255}
          value={input.title} onChange={(e) => onChange({ title: e.target.value })}
          placeholder="What are you planning?" className={controlClass} />
        {error('title')}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" name="isAllDay" checked={input.isAllDay}
          onChange={(e) => toggleAllDay(e.target.checked)} className="size-4 accent-primary" />
        All day
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        {(['start', 'end'] as const).map((field) => (
          <div key={field} className="min-w-0">
            <label htmlFor={`${prefix}-${field}`} className="text-sm font-medium">
              {field === 'start' ? 'Starts' : input.isAllDay ? 'Ends (inclusive)' : 'Ends'}
            </label>
            <input {...attributes(field)} name={field} type={input.isAllDay ? 'date' : 'datetime-local'}
              required value={input[field]} onChange={(e) => onChange({ [field]: e.target.value })}
              className={`${controlClass} min-w-0`} />
            {error(field)}
          </div>
        ))}
      </div>

      <div>
        <label htmlFor={`${prefix}-timeZone`} className="text-sm font-medium">Time zone</label>
        <select {...attributes('timeZone')} name="timeZone" value={timeZones.some((zone) => zone.id === input.timeZone) ? input.timeZone : ''}
          disabled={disabled || loadingZones || !timeZones.length} required
          onChange={(e) => onChange({ timeZone: e.target.value })} className={controlClass}>
          <option value="" disabled>{loadingZones ? 'Loading Outlook time zones…' : 'Choose a time zone'}</option>
          {timeZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
        </select>
        {error('timeZone')}
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {input.isAllDay ? 'All-day events keep their calendar dates.' : 'Times are entered in this zone. Changing it keeps the clock times above.'}
        </p>
      </div>

      <div>
        <label htmlFor={`${prefix}-location`} className="text-sm font-medium">Location <span className="font-normal text-muted-foreground">(optional)</span></label>
        <input {...attributes('location')} name="location" type="text" maxLength={255}
          value={input.location ?? ''} onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Add a place" className={controlClass} />
        {error('location')}
      </div>

      <div>
        <label htmlFor={`${prefix}-notes`} className="text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea {...attributes('notes')} name="notes" rows={3} maxLength={10000}
          value={input.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Anything you want to remember" className={`${controlClass} resize-y`} />
        {error('notes')}
      </div>
    </fieldset>
  )
}
