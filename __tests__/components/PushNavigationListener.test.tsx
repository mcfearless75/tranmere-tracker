import { render, waitFor } from '@testing-library/react'
import { PushNavigationListener } from '@/components/PushNavigationListener'

const push = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args) }),
}))

let isNativeMock = false
jest.mock('@/lib/native', () => ({
  isNative: () => isNativeMock,
}))

const remove = jest.fn()
let capturedListener: ((action: { notification: { data?: unknown } }) => void) | undefined
const addListener = jest.fn((_event: string, listener: typeof capturedListener) => {
  capturedListener = listener
  return Promise.resolve({ remove })
})
jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { addListener: (...args: [string, unknown]) => addListener(...args) },
}))

describe('PushNavigationListener', () => {
  beforeEach(() => {
    isNativeMock = false
    push.mockClear()
    addListener.mockClear()
    remove.mockClear()
    capturedListener = undefined
  })

  it('does nothing on web — never touches the Capacitor plugin', async () => {
    render(<PushNavigationListener />)
    await new Promise(r => setTimeout(r, 0))
    expect(addListener).not.toHaveBeenCalled()
  })

  it('registers a pushNotificationActionPerformed listener on native', async () => {
    isNativeMock = true
    render(<PushNavigationListener />)
    await waitFor(() => expect(addListener).toHaveBeenCalledWith('pushNotificationActionPerformed', expect.any(Function)))
  })

  it('navigates to the notification URL when a push is tapped', async () => {
    isNativeMock = true
    render(<PushNavigationListener />)
    await waitFor(() => expect(capturedListener).toBeDefined())

    capturedListener!({ notification: { data: { url: '/admin/wellbeing' } } })

    expect(push).toHaveBeenCalledWith('/admin/wellbeing')
  })

  it('ignores a payload with no url', async () => {
    isNativeMock = true
    render(<PushNavigationListener />)
    await waitFor(() => expect(capturedListener).toBeDefined())

    capturedListener!({ notification: { data: {} } })

    expect(push).not.toHaveBeenCalled()
  })

  it('ignores a non-path url (defends against an unexpected payload shape)', async () => {
    isNativeMock = true
    render(<PushNavigationListener />)
    await waitFor(() => expect(capturedListener).toBeDefined())

    capturedListener!({ notification: { data: { url: 'https://evil.example.com' } } })

    expect(push).not.toHaveBeenCalled()
  })

  it('removes the listener on unmount', async () => {
    isNativeMock = true
    const { unmount } = render(<PushNavigationListener />)
    await waitFor(() => expect(addListener).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(remove).toHaveBeenCalled())
  })
})
