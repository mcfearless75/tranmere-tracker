import { render } from '@testing-library/react'
import { SplashScreen } from '@/components/SplashScreen'

let isNativeMock = false
jest.mock('@/lib/native', () => ({
  isNative: () => isNativeMock,
}))

const hide = jest.fn().mockResolvedValue(undefined)
jest.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: (...args: unknown[]) => hide(...args) },
}))

describe('SplashScreen — native launch-splash handoff', () => {
  beforeEach(() => {
    isNativeMock = false
    hide.mockClear()
    sessionStorage.clear()
  })

  it('hides the native launch splash on mount when running natively', async () => {
    isNativeMock = true
    render(<SplashScreen />)
    await new Promise(r => setTimeout(r, 0))
    expect(hide).toHaveBeenCalled()
  })

  it('never touches the native plugin on web', async () => {
    render(<SplashScreen />)
    await new Promise(r => setTimeout(r, 0))
    expect(hide).not.toHaveBeenCalled()
  })
})
