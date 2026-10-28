// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventComposer, EventCreationNotice, NewEventButton } from '../components/event-composer'
import type { CreateEventInput, CreateEventResult } from '../lib/calendar-types'

const mocks = vi.hoisted(() => ({ createEvent: vi.fn(), loadTimeZones: vi.fn(), refresh: vi.fn() }))
vi.mock('../app/actions', () => ({ createEvent: mocks.createEvent, loadTimeZones: mocks.loadTimeZones }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

const storageKey = 'up-next:event-draft:v1:test-user'
const example: CreateEventInput = {
  title: 'Focus time', start: '2030-06-12T10:00', end: '2030-06-12T10:30',
  timeZone: 'America/New_York', isAllDay: false, location: 'Home', notes: 'Read a book',
  transactionId: 'a05ac985-969b-4acc-90c9-96974ad7368d',
}
const success: CreateEventResult = { status: 'success', event: {
  id: 'event-1', subject: 'Focus time', start: '2030-06-12T14:00:00Z', end: '2030-06-12T14:30:00Z',
  isAllDay: false, webLink: 'https://outlook.office.com/event-1',
} }

function mount(draftKey = 'test-user') {
  return render(<EventComposer account="me@example.com" draftKey={draftKey}>
    <main><NewEventButton /><EventCreationNotice /></main>
  </EventComposer>)
}
async function openForm() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'New event' }))
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Time zone' })).toBeEnabled())
  return user
}
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /Title/ }), example.title)
  fireEvent.change(screen.getByLabelText('Starts'), { target: { value: example.start } })
  fireEvent.change(screen.getByLabelText('Ends'), { target: { value: example.end } })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Time zone' }), example.timeZone)
}

beforeEach(() => {
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  mocks.createEvent.mockReset().mockResolvedValue(success)
  mocks.refresh.mockReset()
  mocks.loadTimeZones.mockReset().mockResolvedValue({ status: 'success', timeZones: [
    { id: 'UTC', label: 'UTC' }, { id: 'America/New_York', label: 'America/New_York' },
    { id: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  ] })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: false, media: query,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false } }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('event dialog', () => {
  it('focuses the title, validates required fields, and closes with Escape to its trigger', async () => {
    mount()
    const user = await openForm()
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('Enter an event title.')).toBeVisible()
    expect(mocks.createEvent).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'New event' })).toHaveFocus())
  })

  it('keeps entered clock times when the time zone changes and supports all-day ranges', async () => {
    mount()
    const user = await openForm()
    await fillForm(user)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time zone' }), 'Asia/Tokyo')
    expect(screen.getByLabelText('Starts')).toHaveValue(example.start)
    expect(screen.getByLabelText('Ends')).toHaveValue(example.end)
    await user.click(screen.getByRole('checkbox', { name: 'All day' }))
    expect(screen.getByLabelText('Starts')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Ends (inclusive)')).toHaveValue('2030-06-12')
    fireEvent.change(screen.getByLabelText('Ends (inclusive)'), { target: { value: '2030-06-14' } })
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    await waitFor(() => expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      isAllDay: true, start: '2030-06-12', end: '2030-06-14', timeZone: 'Asia/Tokyo',
    })))
  })

  it('requires an explicit time zone when Outlook does not support the device zone', async () => {
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const available = deviceZone === 'Asia/Tokyo' ? 'America/New_York' : 'Asia/Tokyo'
    mocks.loadTimeZones.mockResolvedValue({ status: 'success', timeZones: [{ id: available, label: available }] })
    mount()
    const user = await openForm()
    const select = screen.getByRole('combobox', { name: 'Time zone' })
    expect(select).toHaveValue('')
    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Focus time')
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('Choose a supported time zone.')).toBeVisible()
    expect(mocks.createEvent).not.toHaveBeenCalled()
    await user.selectOptions(select, available)
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    await waitFor(() => expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({ timeZone: available })))
  })

  it('refreshes and links to Outlook only after confirmed success', async () => {
    mount()
    const user = await openForm()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('“Focus time” was saved to Outlook.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open in Outlook' })).toHaveAttribute('href', 'https://outlook.office.com/event-1')
    expect(screen.getByText(/outside the next 14 days/)).toBeVisible()
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(storageKey)).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('restores the draft after consent and waits for an explicit second save', async () => {
    mocks.createEvent.mockResolvedValueOnce({ status: 'needs_authorization', authorizationUrl: 'https://connect.vercel.com/authorize', message: 'Enable calendar creation.' })
    const first = mount()
    const user = await openForm()
    await fillForm(user)
    await user.type(screen.getByRole('textbox', { name: /Location/ }), 'Home')
    await user.type(screen.getByRole('textbox', { name: /Notes/ }), 'Read a book')
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByRole('link', { name: 'Enable Outlook access' })).toHaveAttribute('href', 'https://connect.vercel.com/authorize')
    const request = mocks.createEvent.mock.calls[0][0]
    expect(JSON.parse(sessionStorage.getItem(storageKey)!)).toMatchObject({ version: 1, input: request, uncertain: false })
    first.unmount()
    window.history.replaceState({}, '', '/?newEvent=1')
    mount()
    expect(await screen.findByText(/Your draft is restored/)).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save event' })).toBeEnabled())
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('Focus time')
    expect(screen.getByRole('textbox', { name: /Notes/ })).toHaveValue('Read a book')
    expect(mocks.createEvent).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('')
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('“Focus time” was saved to Outlook.')).toBeVisible()
    expect(mocks.createEvent.mock.calls[1][0]).toEqual(request)
  })

  it('retains locked requests through uncertain retries, even if a later attempt fails before writing', async () => {
    mocks.createEvent.mockResolvedValueOnce({ status: 'error', uncertain: true, message: 'Unknown outcome.' })
      .mockResolvedValueOnce({ status: 'error', uncertain: false, message: 'Please wait.' })
    mount()
    const user = await openForm()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('Unknown outcome.')).toBeVisible()
    expect(screen.getByRole('textbox', { name: /Title/ })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Retry save' }))
    expect(await screen.findByText('Please wait.')).toBeVisible()
    expect(screen.getByRole('textbox', { name: /Title/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retry save' }))
    expect(await screen.findByText('“Focus time” was saved to Outlook.')).toBeVisible()
    expect(mocks.createEvent.mock.calls[1][0]).toEqual(mocks.createEvent.mock.calls[0][0])
    expect(mocks.createEvent.mock.calls[2][0]).toEqual(mocks.createEvent.mock.calls[0][0])
  })

  it('retains pending requests across reloads with the original transaction ID', async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, input: example, uncertain: true }))
    window.history.replaceState({}, '', '/?newEvent=1')
    mount()
    expect(await screen.findByRole('textbox', { name: /Title/ })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry save' })).toBeEnabled())
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry save' }))
    expect(await screen.findByText('“Focus time” was saved to Outlook.')).toBeVisible()
    expect(mocks.createEvent).toHaveBeenCalledWith(example)
  })

  it('lets the user discard an uncertain draft after checking Outlook', async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, input: example, uncertain: true }))
    window.history.replaceState({}, '', '/?newEvent=1')
    mount()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Discard draft' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(sessionStorage.getItem(storageKey)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'New event' }))
    expect(await screen.findByRole('textbox', { name: /Title/ })).toHaveValue('')
  })

  it('disables repeat submission and dismissal while saving', async () => {
    let resolve!: (result: CreateEventResult) => void
    mocks.createEvent.mockReturnValueOnce(new Promise<CreateEventResult>((done) => { resolve = done }))
    mount()
    const user = await openForm()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close event form' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(mocks.createEvent).toHaveBeenCalledTimes(1)
    resolve(success)
    expect(await screen.findByText('“Focus time” was saved to Outlook.')).toBeVisible()
  })

  it('retains editable drafts for field validation and recoverable failures', async () => {
    mocks.createEvent.mockResolvedValueOnce({ status: 'validation_error', fieldErrors: { end: 'End must be after the start.' } })
    mount()
    const user = await openForm()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    expect(await screen.findByText('End must be after the start.')).toBeVisible()
    expect(screen.getByRole('textbox', { name: /Title/ })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('Focus time')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('opens authorization in another tab when draft storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    mocks.createEvent.mockResolvedValueOnce({ status: 'needs_authorization', authorizationUrl: 'https://connect.vercel.com/authorize', message: 'Enable creation.' })
    mount()
    const user = await openForm()
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save event' }))
    await user.click(await screen.findByRole('link', { name: 'Enable Outlook access' }))
    expect(open).toHaveBeenCalledWith('https://connect.vercel.com/authorize', '_blank', 'noopener,noreferrer')
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('Focus time')
  })

  it('does not restore another signed-in identity’s draft', async () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, input: example, uncertain: true }))
    window.history.replaceState({}, '', '/?newEvent=1')
    mount('another-user')
    expect(await screen.findByRole('textbox', { name: /Title/ })).toHaveValue('')
    expect(mocks.createEvent).not.toHaveBeenCalled()
  })
})
