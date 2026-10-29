import { CalendarDays, CircleCheck, ExternalLink, LoaderCircle } from 'lucide-react'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { getUpcomingEvents, getCurrentUserId, MS_GRAPH_CONNECTOR, MS_GRAPH_SCOPES } from '@/lib/graph'
import type { CalendarResult, CalendarStatus } from '@/lib/calendar-types'
import { CalendarAgenda } from './calendar-agenda'
import { EventComposer, NewEventButton, EventCreationNotice } from './event-composer'
import { ConnectState } from './connect-state'
import { SetupState } from './setup-state'
import { RefreshButton } from './refresh-button'

const statusLabels: Record<CalendarStatus, string> = {
  connected: 'Calendar loaded from Microsoft Graph',
  needs_authorization: 'Outlook authorization needed',
  needs_setup: 'Connector setup needed',
  passport_missing: 'No Passport identity received',
  error: 'Calendar could not be loaded',
}

export function LiveCalendarLoading() {
  return <div className="live-loading" role="status"><LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" /><p>Checking the live Outlook connection…</p><span>The illustrated comparison is ready to explore.</span></div>
}

export function LiveCalendarContent({ result, identityReceived, connectorUid, draftKey }: { result: CalendarResult; identityReceived: boolean; connectorUid: string; draftKey: string }) {
  return <EventComposer key={draftKey} draftKey={draftKey} account={result.account}>
    <div className="live-status" role="group" aria-label="Observed live connection status">
      <p className="eyebrow">Observed on this page request</p>
      <dl><div><dt>Passport identity</dt><dd>{identityReceived ? 'Received' : 'Not received'}</dd></div><div><dt>Outlook</dt><dd className="inline-flex items-start gap-1.5">{result.status === 'connected' && <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />}{statusLabels[result.status]}</dd></div><div><dt>Connector</dt><dd className="font-mono text-[11px] break-all">{connectorUid}</dd></div></dl>
      <details><summary>Requested permissions</summary><p>The agenda requests <code>{MS_GRAPH_SCOPES.join(' · ')}</code>. The event form requests <code>Calendars.ReadWrite</code> on save. These are requested scopes, not a report of granted permissions.</p><p>This panel does not observe token refresh, token expiry, or role membership.</p></details>
    </div>
    <div className="live-calendar-body">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><CalendarDays className="size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><h3 className="text-base font-semibold">Up Next</h3><p className="break-words text-xs text-muted-foreground">{result.status === 'connected' && result.account ? result.account : 'Your Microsoft Outlook calendar'}</p></div></div>{result.status === 'connected' && <div className="flex shrink-0 gap-2"><NewEventButton /><RefreshButton /></div>}</div>
      <EventCreationNotice />
      <div className="live-calendar-state @container mt-5">
        {result.status === 'needs_setup' && <SetupState message={result.message} connectorUid={connectorUid} />}
        {result.status === 'needs_authorization' && <ConnectState authorizationUrl={result.authorizationUrl} />}
        {result.status === 'passport_missing' && <div className="live-message"><div className="live-message-icon"><CalendarDays className="size-6" aria-hidden="true" /></div><h3>Vercel Passport not configured</h3><p>No Passport user identity was received. Open a Passport-protected deployment to sign in with your company identity provider and use your real calendar.</p><a className="source-link" href="https://vercel.com/docs/passport" target="_blank" rel="noopener noreferrer">Configure Passport <ExternalLink className="size-3.5" aria-hidden="true" /></a></div>}
        {result.status === 'error' && <div className="live-message"><h3>Couldn&apos;t load your calendar</h3><p>{result.message ?? 'Something went wrong while reaching Microsoft Graph.'}</p><RefreshButton /></div>}
        {result.status === 'connected' && <CalendarAgenda events={result.events} account={result.account} />}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Real Outlook data only. Event creation writes to your calendar when you explicitly save. The comparison controls never change this connection.</p>
    </div>
  </EventComposer>
}

export async function LiveCalendarPanel() {
  const requestHeaders = await headers()
  const identity = getCurrentUserId(requestHeaders)
  const result = await getUpcomingEvents(requestHeaders)
  const draftKey = identity.ok ? createHash('sha256').update(identity.userId).digest('hex') : 'signed-out'
  return <LiveCalendarContent result={result} identityReceived={identity.ok} connectorUid={MS_GRAPH_CONNECTOR} draftKey={draftKey} />
}
