'use client'

import { createContext, useContext, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { CalendarPlus, CheckCircle2, ExternalLink, LoaderCircle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createEvent, loadTimeZones } from '@/app/actions'
import type { CalendarActionFailure, CreatedEvent, CreateEventInput, EventFieldErrors, TimeZoneOption } from '@/lib/calendar-types'
import { newEventDraft, parseSavedDraft } from '@/lib/event-draft'
import { eventTimeBounds } from '@/lib/time'
import { EventForm } from './event-form'

const NoticeContext = createContext<{ event: CreatedEvent | null; dismiss: () => void }>({ event: null, dismiss: () => {} })

export function NewEventButton({ className = '' }: { className?: string }) {
  return <Dialog.Trigger className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${className}`}>
    <CalendarPlus className="size-4" aria-hidden="true" /> New event
  </Dialog.Trigger>
}

export function EventCreationNotice() {
  const { event, dismiss } = useContext(NoticeContext)
  if (!event) return null
  const now = Date.now()
  const bounds = eventTimeBounds(event)
  const outsideAgenda = bounds.end <= now || bounds.start >= now + 14 * 86400000
  return <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/25 bg-accent p-4 text-sm">
    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="font-medium">“{event.subject}” was saved to Outlook.</p>
      {outsideAgenda && <p className="mt-1 text-muted-foreground">It is outside the next 14 days, so it won&apos;t appear in this agenda.</p>}
      {event.webLink && <a href={event.webLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4">Open in Outlook <ExternalLink className="size-3.5" aria-hidden="true" /></a>}
    </div>
    <button type="button" onClick={dismiss} aria-label="Dismiss confirmation" className="rounded-lg p-1 hover:bg-background/50"><X className="size-4" /></button>
  </div>
}

export function EventComposer({ account, draftKey, children }: { account?: string | null; draftKey: string; children: ReactNode }) {
  const router = useRouter()
  const storageKey = `up-next:event-draft:v1:${draftKey}`
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CreateEventInput | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [failure, setFailure] = useState<CalendarActionFailure | null>(null)
  const [errors, setErrors] = useState<EventFieldErrors>({})
  const [notice, setNotice] = useState<CreatedEvent | null>(null)
  const [timeZones, setTimeZones] = useState<TimeZoneOption[]>([])
  const [loadingZones, setLoadingZones] = useState(false)
  const [zoneAttempt, setZoneAttempt] = useState(0)
  const [zoneFailure, setZoneFailure] = useState<CalendarActionFailure | null>(null)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [restored, setRestored] = useState(false)
  const [isPending, startTransition] = useTransition()
  const titleRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inFlight = useRef(false)

  function storeDraft(input: CreateEventInput, unknownOutcome: boolean) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, input, uncertain: unknownOutcome }))
      setStorageAvailable(true)
      return true
    } catch {
      setStorageAvailable(false)
      return false
    }
  }
  function clearStorage() {
    try { sessionStorage.removeItem(storageKey) } catch { /* Storage can be disabled. */ }
  }

  useEffect(() => {
    // Drafts are scoped to the signed-in Passport identity and this browser tab.
    let saved = null
    try { saved = parseSavedDraft(sessionStorage.getItem(storageKey)) } catch { /* No storage. */ }
    const url = new URL(window.location.href)
    if (saved) {
      setDraft(saved.input)
      setUncertain(saved.uncertain)
    }
    if (url.searchParams.has('newEvent')) {
      setDraft(saved?.input ?? newEventDraft())
      setOpen(true)
      setRestored(Boolean(saved))
      url.searchParams.delete('newEvent')
      window.history.replaceState(window.history.state, '', url)
    }
  }, [storageKey])

  useEffect(() => {
    if (!open) return
    let active = true
    setLoadingZones(true)
    setZoneFailure(null)
    loadTimeZones().then((result) => {
      if (!active) return
      if (result.status === 'success') {
        setTimeZones(result.timeZones)
        setDraft((current) => {
          if (!current) return current
          const canonical = (zone: string) => {
            try { return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone } catch { return zone }
          }
          const match = result.timeZones.find((zone) => canonical(zone.id) === canonical(current.timeZone))
          // Keep a submitted request immutable when its outcome is unknown.
          if (match && !uncertain) return { ...current, timeZone: match.id }
          return current
        })
      } else setZoneFailure(result)
    }).catch(() => {
      if (active) setZoneFailure({ status: 'error', uncertain: false, message: 'Could not load time zones. Please retry.' })
    }).finally(() => { if (active) setLoadingZones(false) })
    return () => { active = false }
  }, [open, zoneAttempt, uncertain])

  function change(patch: Partial<CreateEventInput>) {
    if (uncertain || inFlight.current) return
    setDraft((current) => current ? { ...current, ...patch, transactionId: crypto.randomUUID() } : current)
    setErrors({})
    setFailure(null)
    setRestored(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || inFlight.current) return
    if (!draft.title.trim() || !draft.start || !draft.end || !timeZones.some((zone) => zone.id === draft.timeZone)) {
      setErrors({
        ...(!draft.title.trim() ? { title: 'Enter an event title.' } : {}),
        ...(!draft.start ? { start: 'Enter a start date and time.' } : {}),
        ...(!draft.end ? { end: 'Enter an end date and time.' } : {}),
        ...(!timeZones.some((zone) => zone.id === draft.timeZone) ? { timeZone: 'Choose a supported time zone.' } : {}),
      })
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    inFlight.current = true
    setFailure(null)
    setErrors({})
    // A browser disconnect can happen after Outlook has saved. Persist the exact
    // submitted request before sending it so a reload can retry its transaction ID.
    storeDraft(draft, true)
    startTransition(async () => {
      try {
        const result = await createEvent(draft)
        if (result.status === 'success') {
          clearStorage()
          setNotice(result.event)
          setOpen(false)
          setDraft(null)
          setUncertain(false)
          setRestored(false)
          router.refresh()
        } else {
          // Once a previous attempt is uncertain, a subsequent pre-write error
          // cannot prove that the earlier attempt failed.
          const stillUncertain = uncertain || (result.status === 'error' && result.uncertain)
          setUncertain(stillUncertain)
          storeDraft(draft, stillUncertain)
          if (result.status === 'validation_error') {
            setErrors(result.fieldErrors)
            requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
          } else setFailure(result)
        }
      } catch {
        setUncertain(true)
        storeDraft(draft, true)
        setFailure({ status: 'error', uncertain: true, message: 'The save status is unknown. Retry this same request to avoid creating a duplicate.' })
      } finally { inFlight.current = false }
    })
  }

  const displayedFailure = failure ?? zoneFailure
  const authorization = displayedFailure?.status === 'needs_authorization' ? displayedFailure.authorizationUrl : undefined

  return <NoticeContext.Provider value={{ event: notice, dismiss: () => setNotice(null) }}>
    <Dialog.Root open={open} disablePointerDismissal onOpenChange={(nextOpen, details) => {
      if (inFlight.current) { details.cancel(); return }
      if (nextOpen) { setDraft((current) => current ?? newEventDraft()); setErrors({}); setFailure(null) }
      else if (!uncertain) { clearStorage(); setDraft(null); setRestored(false) }
      setOpen(nextOpen)
    }}>
      {children}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup initialFocus={titleRef} className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-card p-5 text-card-foreground shadow-xl outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90dvh] sm:w-[min(38rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:border-border sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-2xl font-semibold tracking-tight">New event</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Save a personal appointment to {account ? `${account}’s` : 'your default Outlook'} calendar. No invitations will be sent.
              </Dialog.Description>
            </div>
            <Dialog.Close disabled={isPending} aria-label="Close event form" className="shrink-0 rounded-full p-2 hover:bg-secondary disabled:opacity-50"><X className="size-5" aria-hidden="true" /></Dialog.Close>
          </div>
          {restored && <p role="status" className="mt-4 rounded-xl bg-secondary p-3 text-sm">Your draft is restored. If permission was granted, select Save event to finish.</p>}
          {uncertain && <div role="alert" className="mt-4 rounded-xl border border-primary/30 bg-accent p-3 text-sm">
            <p>The last save could not be confirmed. The fields are locked so Retry save sends the same event request. Check your calendar in Outlook before discarding this draft.</p>
            <button type="button" disabled={isPending} className="mt-2 font-medium text-primary underline underline-offset-4 disabled:opacity-50" onClick={() => {
              clearStorage(); setUncertain(false); setDraft(null); setFailure(null); setRestored(false); setOpen(false)
            }}>Discard draft</button>
          </div>}
          <form ref={formRef} onSubmit={submit} noValidate className="mt-6 flex min-h-0 flex-1 flex-col">
            {draft && <EventForm input={draft} onChange={change} errors={errors} timeZones={timeZones} loadingZones={loadingZones} disabled={isPending || uncertain} titleRef={titleRef} />}
            {displayedFailure && <div role="alert" className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
              <p>{displayedFailure.status === 'validation_error' ? 'Check the event details above.' : displayedFailure.message}</p>
              {authorization && <>
                <a href={authorization} target={storageAvailable ? undefined : '_blank'} rel="noopener noreferrer"
                  onClick={(event) => {
                    if (draft && !storeDraft(draft, uncertain)) {
                      event.preventDefault()
                      window.open(authorization, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground">Enable Outlook access</a>
                {!storageAvailable && <p className="mt-2">Authorization opens in another tab because temporary storage is unavailable. Return to this form afterward.</p>}
              </>}
              {zoneFailure && <button type="button" onClick={() => setZoneAttempt((n) => n + 1)} className="mt-2 block font-medium text-primary underline underline-offset-4">Retry loading time zones</button>}
            </div>}
            {errors.transactionId && <p role="alert" className="mt-3 text-sm text-destructive">{errors.transactionId}</p>}
            <div className="mt-6 flex flex-1 items-end justify-end gap-3 border-t border-border pt-5">
              <Dialog.Close disabled={isPending} className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50">{uncertain ? 'Close' : 'Cancel'}</Dialog.Close>
              <button type="submit" disabled={isPending || loadingZones || !timeZones.length} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                {isPending ? 'Saving…' : uncertain ? 'Retry save' : 'Save event'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </NoticeContext.Provider>
}
