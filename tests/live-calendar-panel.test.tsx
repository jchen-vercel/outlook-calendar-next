// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LiveCalendarContent, LiveCalendarLoading, LiveCalendarPanel } from '../components/live-calendar-panel'
import { ShowcaseExplorer } from '../components/showcase-explorer'
import type { CalendarResult, CalendarStatus } from '../lib/calendar-types'

const mocks = vi.hoisted(() => ({
  getUpcomingEvents: vi.fn(), getCurrentUserId: vi.fn(), headers: vi.fn(),
  createEvent: vi.fn(), loadTimeZones: vi.fn(), refresh: vi.fn(),
}))
vi.mock('../lib/graph', () => ({
  getUpcomingEvents: mocks.getUpcomingEvents, getCurrentUserId: mocks.getCurrentUserId,
  MS_GRAPH_CONNECTOR: 'oauth/microsoft-graph',
  MS_GRAPH_SCOPES: ['openid', 'profile', 'offline_access', 'Calendars.Read', 'User.Read'],
}))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../app/actions', () => ({ createEvent: mocks.createEvent, loadTimeZones: mocks.loadTimeZones }))

beforeEach(() => {
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.clearAllMocks()
  mocks.loadTimeZones.mockResolvedValue({ status: 'success', timeZones: [{ id: 'UTC', label: 'UTC' }] })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function mount(result: CalendarResult) {
  return render(<><ShowcaseExplorer /><LiveCalendarContent result={result} identityReceived={result.status !== 'passport_missing'} connectorUid="oauth/microsoft-graph" draftKey="test-identity" /></>)
}

describe('live calendar integration in the showcase', () => {
  const states: [CalendarStatus, string][] = [
    ['connected', 'Calendar loaded from Microsoft Graph'],
    ['needs_authorization', 'Outlook authorization needed'],
    ['needs_setup', 'Connector setup needed'],
    ['passport_missing', 'No Passport identity received'],
    ['error', 'Calendar could not be loaded'],
  ]
  it.each(states)('keeps the comparison usable with live status %s', async (status, label) => {
    mount({ status, events: [], authorizationUrl: 'https://connect.vercel.com/example', message: status === 'error' ? 'Microsoft Graph is unavailable.' : undefined })
    const observed = screen.getByLabelText('Observed live connection status')
    expect(within(observed).getByText(label)).toBeVisible()
    expect(within(observed).getByText('oauth/microsoft-graph')).toBeVisible()
    expect(within(observed).getByText(status === 'passport_missing' ? 'Not received' : 'Received')).toBeVisible()
    await userEvent.click(screen.getByRole('tab', { name: /Add another app/ }))
    expect(screen.getByRole('heading', { name: 'Another team builds a calendar tool.' })).toBeVisible()
    expect(mocks.createEvent).not.toHaveBeenCalled()
    expect(mocks.loadTimeZones).not.toHaveBeenCalled()
  })

  it('retains the real consent URL and distinguishes requested permissions from granted permissions', async () => {
    mount({ status: 'needs_authorization', events: [], authorizationUrl: 'https://connect.vercel.com/real-consent' })
    expect(screen.getByRole('link', { name: 'Connect Microsoft Outlook' })).toHaveAttribute('href', 'https://connect.vercel.com/real-consent')
    await userEvent.click(screen.getByText('Requested permissions'))
    expect(screen.getByText(/not a report of granted permissions/)).toBeVisible()
    expect(screen.getByText(/does not observe token refresh/)).toBeVisible()
    expect(screen.getByText('Microsoft client secrets and refresh tokens are managed outside this application.')).toBeVisible()
  })

  it('keeps real event data and refresh controls in the connected panel', async () => {
    const start = Date.now() + 3600000
    mount({ status: 'connected', account: 'employee@example.com', events: [{
      id: 'graph-event', subject: 'Actual Graph event', start: new Date(start).toISOString(), end: new Date(start + 1800000).toISOString(),
      isAllDay: false, location: null, organizer: null, attendees: [], onlineMeetingUrl: null, webLink: null, bodyPreview: null, isCancelled: false, responseStatus: null,
    }] })
    expect(await screen.findByText('Actual Graph event')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh calendar' }))
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.createEvent).not.toHaveBeenCalled()
  })

  it('preserves the newEvent return flow without automatically writing an event', async () => {
    window.history.replaceState({}, '', '/?newEvent=1')
    mount({ status: 'connected', events: [] })
    expect(await screen.findByRole('dialog', { name: 'New event' })).toBeVisible()
    await waitFor(() => expect(mocks.loadTimeZones).toHaveBeenCalledOnce())
    expect(mocks.createEvent).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('derives draft isolation on the server and passes only identity presence to the status panel', async () => {
    const requestHeaders = new Headers()
    mocks.headers.mockResolvedValue(requestHeaders)
    mocks.getCurrentUserId.mockReturnValue({ ok: true, userId: 'private-corporate-subject' })
    mocks.getUpcomingEvents.mockResolvedValue({ status: 'connected', events: [] })
    const element = await LiveCalendarPanel()
    expect(mocks.getUpcomingEvents).toHaveBeenCalledWith(requestHeaders)
    expect(element.props.identityReceived).toBe(true)
    expect(element.props.draftKey).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(element.props)).not.toContain('private-corporate-subject')
    render(element)
    expect(screen.getByLabelText('Observed live connection status')).toHaveTextContent('Received')
  })

  it('labels the loading panel without reporting a connection success', () => {
    render(<LiveCalendarLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking the live Outlook connection')
    expect(screen.queryByText('Calendar loaded from Microsoft Graph')).not.toBeInTheDocument()
  })
})
