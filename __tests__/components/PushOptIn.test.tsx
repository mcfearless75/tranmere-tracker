import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { PushOptIn } from '@/components/PushOptIn'

const PENDING_KEY = 'tt-native-push-register-pending'

let isNativeMock = true
let isAndroidMock = true
let shellVersionMock = 0
jest.mock('@/lib/native', () => ({
  isNative: () => isNativeMock,
  isAndroid: () => isAndroidMock,
  getPlatform: () => 'android',
  getNativeShellVersion: () => shellVersionMock,
  ANDROID_PUSH_MIN_SHELL: 2,
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

describe('PushOptIn — native registration disabled on pre-fix Android shells', () => {
  // 2026-09-11: PushNotifications.register() crashes the app on Android
  // 100% of the time, with no diagnosis available yet (Crashlytics, added
  // specifically to get a stack trace, never received a single session
  // ping). Home renders this component, so leaving it enabled bricks the
  // app for every Android user. Disabled at the isAndroid() check —
  // these tests are the regression guard for that: the crashing native
  // calls must never be reached on Android, not even via an explicit tap.
  // 2026-09-25: root cause was the missing google-services.json; fixed in
  // native shell 2. Shells without the TTNative/2 marker keep this guard.
  beforeEach(() => {
    isNativeMock = true
    isAndroidMock = true
    shellVersionMock = 0
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

  it('tells the user to update the app instead of hiding silently — no button to tap', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)
    await new Promise(r => setTimeout(r, 0))

    expect(screen.getByText(/Update Tranmere Tracker from the Play Store/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('PushOptIn — Android native shell 2+ (google-services.json shipped)', () => {
  beforeEach(() => {
    isNativeMock = true
    isAndroidMock = true
    shellVersionMock = 2
    localStorage.clear()
    createChannel.mockClear()
    checkPermissions.mockReset()
    requestPermissions.mockReset()
    register.mockClear()
    addListener.mockClear()
    registrationListener = undefined
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch
  })

  it('creates the channel, registers silently when already granted, and saves the token', async () => {
    checkPermissions.mockResolvedValue({ receive: 'granted' })

    render(<PushOptIn />)
    await waitFor(() => expect(register).toHaveBeenCalled())
    expect(createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'messages' }))

    registrationListener?.({ value: 'fcm-token' })
    await waitFor(() => expect(screen.getByText(/Notifications enabled/i)).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/push/native-register', expect.anything())
  })

  it('shows the enable button when permission has not been asked yet', async () => {
    checkPermissions.mockResolvedValue({ receive: 'prompt' })

    render(<PushOptIn />)
    await waitFor(() => expect(checkPermissions).toHaveBeenCalled())

    expect(screen.getByRole('button', { name: /Enable notifications/i })).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })
})

describe('PushOptIn — iOS Safari outside Home Screen install (web path)', () => {
  // iOS Safari exposes Notification/serviceWorker/PushManager even outside
  // standalone, so the generic feature-detection "unsupported" check never
  // caught this — subscribing from a normal browser tab just failed with an
  // opaque "Load failed" and no indication of why. Detected via UA +
  // display-mode instead, ahead of any subscribe attempt.
  const originalUA = navigator.userAgent

  function setUserAgent(ua: string) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  }

  beforeEach(() => {
    isNativeMock = false
    localStorage.clear()
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch
  })

  afterEach(() => {
    setUserAgent(originalUA)
    // Test-only cleanup of a property jsdom doesn't define by default.
    delete (navigator as { standalone?: boolean }).standalone
  })

  it('shows the Home Screen instruction instead of a button, and never requests permission', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    const requestPermissionSpy = jest.fn()
    ;(window as unknown as { Notification: unknown }).Notification = { permission: 'default', requestPermission: requestPermissionSpy }

    render(<PushOptIn />)

    expect(await screen.findByText(/add this app to your Home Screen/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enable notifications/i })).not.toBeInTheDocument()
    expect(requestPermissionSpy).not.toHaveBeenCalled()
  })

  it('does not show the instruction for an iPhone that IS already installed to the Home Screen', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    ;(navigator as unknown as { standalone: boolean }).standalone = true

    render(<PushOptIn />)
    await new Promise(r => setTimeout(r, 0))

    expect(screen.queryByText(/add this app to your Home Screen/i)).not.toBeInTheDocument()
  })
})
