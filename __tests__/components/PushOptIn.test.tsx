import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PushOptIn } from '@/components/PushOptIn'

const PENDING_KEY = 'tt-native-push-register-pending'

let isNativeMock = true
let isAndroidMock = true
jest.mock('@/lib/native', () => ({
  isNative: () => isNativeMock,
  isAndroid: () => isAndroidMock,
  getPlatform: () => 'android',
}))

const createChannel = jest.fn().mockResolvedValue(undefined)
const checkPermissions = jest.fn()
const requestPermissions = jest.fn()
const register = jest.fn().mockResolvedValue(undefined)
const addListener = jest.fn()
let registrationListener: ((token: { value: string }) => void) | undefined

jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    createChannel: (...args: unknown[]) => createChannel(...args),
    checkPermissions: (...args: unknown[]) => checkPermissions(...args),
    requestPermissions: (...args: unknown[]) => requestPermissions(...args),
    register: (...args: unknown[]) => register(...args),
    addListener: (event: string, listener: unknown) => {
      if (event === 'registration') registrationListener = listener as typeof registrationListener
      addListener(event, listener)
      return { remove: jest.fn() }
    },
  },
}))

describe('PushOptIn — native crash-loop guard (iOS — Android registration is disabled, see below)', () => {
  beforeEach(() => {
    isNativeMock = true
    isAndroidMock = false
    localStorage.clear()
    createChannel.mockClear()
    checkPermissions.mockReset()
    requestPermissions.mockReset()
    register.mockClear()
    addListener.mockClear()
    registrationListener = undefined
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch
  })

  it('does not attempt silent registration when a previous attempt never resolved (suspected crash)', async () => {
    localStorage.setItem(PENDING_KEY, String(Date.now()))
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)

    // Give any stray effects a tick, then assert the risky native call was
    // never reached — this is the actual crash-loop protection.
    await new Promise(r => setTimeout(r, 0))
    expect(checkPermissions).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it('shows a warning explaining the previous attempt failed, with a retry button available', async () => {
    localStorage.setItem(PENDING_KEY, String(Date.now()))
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)

    expect(await screen.findByText(/didn't enable properly last time/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enable notifications/i })).toBeInTheDocument()
  })

  it('proceeds with silent auto-registration normally when no pending flag is set', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)

    await waitFor(() => expect(register).toHaveBeenCalled())
  })

  it('sets the pending flag before calling register(), and clears it on success', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' })
    register.mockImplementation(async () => {
      // The flag must already be set by the time register() is reached.
      expect(localStorage.getItem(PENDING_KEY)).not.toBeNull()
    })

    render(<PushOptIn />)
    await waitFor(() => expect(register).toHaveBeenCalled())

    registrationListener!({ value: 'fake-token' })
    await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull())
  })

  it('clears the pending flag on a clean (non-crash) registration failure', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' })
    register.mockRejectedValue(new Error('boom'))

    render(<PushOptIn />)

    await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull())
  })

  it('lets an explicit tap retry after a suspected crash, re-arming the guard', async () => {
    localStorage.setItem(PENDING_KEY, String(Date.now()))
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)
    const button = await screen.findByRole('button', { name: /enable notifications/i })

    fireEvent.click(button)

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
  })

  it('does nothing on web — the guard is native-only', async () => {
    isNativeMock = false
    localStorage.setItem(PENDING_KEY, String(Date.now()))

    render(<PushOptIn />)
    await new Promise(r => setTimeout(r, 0))

    expect(screen.queryByText(/didn't enable properly last time/i)).not.toBeInTheDocument()
  })
})

describe('PushOptIn — native registration disabled on Android', () => {
  // 2026-09-11: PushNotifications.register() crashes the app on Android
  // 100% of the time, with no diagnosis available yet (Crashlytics, added
  // specifically to get a stack trace, never received a single session
  // ping). Home renders this component, so leaving it enabled bricks the
  // app for every Android user. Disabled at the isAndroid() check —
  // these tests are the regression guard for that: the crashing native
  // calls must never be reached on Android, not even via an explicit tap.
  beforeEach(() => {
    isNativeMock = true
    isAndroidMock = true
    localStorage.clear()
    createChannel.mockClear()
    checkPermissions.mockReset()
    requestPermissions.mockReset()
    register.mockClear()
    addListener.mockClear()
    registrationListener = undefined
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch
  })

  it('never calls any native push API on mount, permission already granted', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)
    await new Promise(r => setTimeout(r, 0))

    expect(createChannel).not.toHaveBeenCalled()
    expect(checkPermissions).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it('never calls any native push API on mount, even with a stuck crash-loop flag from before this fix shipped', async () => {
    localStorage.setItem(PENDING_KEY, String(Date.now()))
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)
    await new Promise(r => setTimeout(r, 0))

    expect(register).not.toHaveBeenCalled()
  })

  it('renders nothing — no button for a student to tap', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    const { container } = render(<PushOptIn />)
    await new Promise(r => setTimeout(r, 0))

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
