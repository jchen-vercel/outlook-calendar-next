// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShowcaseExplorer } from '../components/showcase-explorer'
import { ShowcaseResponsibilities } from '../components/showcase-responsibilities'

const actions = vi.hoisted(() => ({ createEvent: vi.fn(), loadTimeZones: vi.fn() }))
vi.mock('../app/actions', () => actions)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
})

describe('showcase comparison', () => {
  it('explains the matching responsibilities for each selected scenario without making requests or changing the callback URL', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    window.history.replaceState({}, '', '/?newEvent=1')
    sessionStorage.setItem('existing-draft', 'untouched')
    const user = userEvent.setup()
    render(<><ShowcaseExplorer /><ShowcaseResponsibilities /></>)

    const scenarios = [
      ['Sign in', 'An employee opens the calendar.', 'Operate sessions and route protection', 'Passport handles deployment sign-in'],
      ['Connect Outlook', 'The employee connects Outlook.', 'Persist the user’s credentials', 'Connect brokers authorization'],
      ['Return later', 'An access token has expired.', 'Operate persistent token storage', 'Connect operates credential refresh'],
      ['Create an event', 'The employee saves a first appointment.', 'Maintain the grant and credentials', 'Connect handles the authorization flow'],
      ['Add another app', 'Another team builds a calendar tool.', 'Integrate credential infrastructure', 'Link an approved shared connector'],
    ]
    for (const [tab, heading, traditional, managed] of scenarios) {
      await user.click(screen.getByRole('tab', { name: new RegExp(tab) }))
      const panel = screen.getByRole('tabpanel')
      expect(within(panel).getByRole('heading', { name: heading })).toBeVisible()
      expect(within(panel).getByRole('region', { name: 'Enterprise-managed integration' })).toHaveTextContent(traditional)
      expect(within(panel).getByRole('region', { name: 'Passport + Vercel Connect' })).toHaveTextContent(managed)
      expect(within(panel).getByText('Still owned by your team')).toBeVisible()
      expect(screen.getByRole('table')).toBeVisible()
    }
    expect(request).not.toHaveBeenCalled()
    expect(actions.createEvent).not.toHaveBeenCalled()
    expect(actions.loadTimeZones).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?newEvent=1')
    expect(sessionStorage.getItem('existing-draft')).toBe('untouched')
    expect(screen.getByRole('link', { name: 'Try the live application' })).toHaveAttribute('href', '#live-calendar')
  })

  it('supports arrow, Home, End, and Tab keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<ShowcaseExplorer />)
    const first = screen.getByRole('tab', { name: /Sign in/ })
    first.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Connect Outlook/ })).toHaveFocus()
    expect(screen.getByRole('tab', { name: /Connect Outlook/ })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: /Add another app/ })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(first).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: /Add another app/ })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(first).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('tabpanel')).toHaveFocus()
    await user.tab()
    expect(document.activeElement?.tagName).toBe('SUMMARY')
  })

  it('keeps illustrations and operational limits explicit', async () => {
    const user = userEvent.setup()
    render(<><ShowcaseExplorer /><ShowcaseResponsibilities /></>)
    expect(screen.getByText('Illustrated comparison')).toBeVisible()
    expect(screen.getByText(/shared Passport connection does not provide a per-project department policy editor/)).toBeVisible()
    await user.click(screen.getByRole('tab', { name: /Return later/ }))
    expect(screen.getByText(/does not tell this UI whether a token was refreshed/)).toBeVisible()
    await user.click(screen.getByText('Look at the implementation'))
    expect(screen.getByText(/Neither implementation needs to hand-write/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Connect token caching and refresh' })).toHaveAttribute('href', 'https://vercel.com/docs/connect/concepts/tokens')
    expect(screen.getByText(/This app uses a custom OAuth connector/)).toBeVisible()
    expect(screen.getByText(/This showcase does not implement department gating/)).toBeVisible()
  })

  it('stays interactive while the live integration is suspended', async () => {
    const pending = new Promise<never>(() => {})
    function SlowLiveCalendar(): never { throw pending }
    const user = userEvent.setup()
    render(<><ShowcaseExplorer /><Suspense fallback={<p role="status">Checking live Outlook…</p>}><SlowLiveCalendar /></Suspense></>)
    await user.click(screen.getByRole('tab', { name: /Create an event/ }))
    expect(screen.getByRole('heading', { name: 'The employee saves a first appointment.' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Checking live Outlook…')
  })
})
