import { render, screen, fireEvent } from '@testing-library/react'
import { InstallGuide, InstallAppButton } from '@/components/pwa/InstallGuide'
import {
  detectPlatform,
  isIpadOs,
  shouldAutoShowGuide,
  canOfferInstall,
  INSTALL_GUIDE_SEEN_KEY,
} from '@/lib/pwa/installUtils'

// --- pure helpers --------------------------------------------------------

describe('installUtils', () => {
  it('detects iOS, Android and other platforms', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('other')
  })

  it('detects iPadOS masquerading as desktop Safari', () => {
    expect(isIpadOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIpadOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIpadOs('Mozilla/5.0 (Windows NT 10.0)', 5)).toBe(false)
  })

  it('auto-shows only on mobile, in the browser, first time', () => {
    const base = { platform: 'ios' as const, isStandalone: false, isNativeApp: false, hasSeenGuide: false }
    expect(shouldAutoShowGuide(base)).toBe(true)
    expect(shouldAutoShowGuide({ ...base, platform: 'android' })).toBe(true)
    expect(shouldAutoShowGuide({ ...base, platform: 'other' })).toBe(false)
    expect(shouldAutoShowGuide({ ...base, isStandalone: true })).toBe(false)
    expect(shouldAutoShowGuide({ ...base, isNativeApp: true })).toBe(false)
    expect(shouldAutoShowGuide({ ...base, hasSeenGuide: true })).toBe(false)
  })

  it('offers the manual button only where install is possible', () => {
    expect(canOfferInstall({ platform: 'ios', isStandalone: false, isNativeApp: false })).toBe(true)
    expect(canOfferInstall({ platform: 'other', isStandalone: false, isNativeApp: false })).toBe(false)
    expect(canOfferInstall({ platform: 'android', isStandalone: true, isNativeApp: false })).toBe(false)
  })
})

// --- component -----------------------------------------------------------

function mockMobileEnvironment(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true })
  window.matchMedia = jest.fn().mockReturnValue({ matches: false, addListener: jest.fn(), removeListener: jest.fn() })
}

describe('InstallGuide', () => {
  beforeEach(() => {
    localStorage.clear()
    mockMobileEnvironment('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
  })

  it('auto-opens once on iPhone and shows Safari instructions', () => {
    render(<InstallGuide />)
    expect(screen.getByRole('dialog', { name: /install the app/i })).toBeInTheDocument()
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument()
  })

  it('"Got it" dismisses and never auto-opens again', () => {
    const { unmount } = render(<InstallGuide />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(INSTALL_GUIDE_SEEN_KEY)).toBe('1')
    unmount()
    render(<InstallGuide />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not auto-open on desktop', () => {
    mockMobileEnvironment('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 0, configurable: true })
    render(<InstallGuide />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('InstallAppButton', () => {
  beforeEach(() => {
    localStorage.clear()
    mockMobileEnvironment('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
  })

  it('renders on mobile and re-opens the guide even after dismissal', () => {
    localStorage.setItem(INSTALL_GUIDE_SEEN_KEY, '1')
    render(<InstallAppButton />)
    const btn = screen.getByRole('button', { name: /install app/i })
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: /install the app/i })).toBeInTheDocument()
    // Android instructions are the active tab
    expect(screen.getByText(/open this site in/i)).toHaveTextContent(/chrome/i)
  })

  it('renders nothing on desktop', () => {
    mockMobileEnvironment('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 0, configurable: true })
    render(<InstallAppButton />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
