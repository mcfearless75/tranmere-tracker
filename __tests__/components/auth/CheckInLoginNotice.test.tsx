import { render, screen } from '@testing-library/react'
import { CheckInLoginNotice } from '@/components/auth/CheckInLoginNotice'
import { describeLoginContext } from '@/lib/auth/loginNotice'

const TAG_LINK = '/attendance?tag=9af4a580bbe347c5aacc551ba56e75c5'

describe('describeLoginContext', () => {
  it('recognises a sticker link', () => {
    expect(describeLoginContext(TAG_LINK)).toEqual({ checkIn: true, moved: false })
  })
  it('recognises the canonical-host hop', () => {
    expect(describeLoginContext(`${TAG_LINK}&moved=1`)).toEqual({ checkIn: true, moved: true })
    expect(describeLoginContext('/dashboard?moved=1')).toEqual({ checkIn: false, moved: true })
  })
  it('is quiet for ordinary destinations, garbage, and nothing', () => {
    expect(describeLoginContext('/dashboard')).toEqual({ checkIn: false, moved: false })
    expect(describeLoginContext('/attendance')).toEqual({ checkIn: false, moved: false })
    expect(describeLoginContext('http://[bad')).toEqual({ checkIn: false, moved: false })
    expect(describeLoginContext(undefined)).toEqual({ checkIn: false, moved: false })
  })
})

describe('CheckInLoginNotice', () => {
  it('renders nothing for a normal login', () => {
    const { container } = render(<CheckInLoginNotice next="/dashboard" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('explains the one-off login and the location prompt for a sticker arrival', () => {
    render(<CheckInLoginNotice next={TAG_LINK} />)
    const notice = screen.getByTestId('checkin-login-notice')
    expect(notice).toHaveTextContent('Checking in? Log in once with your usual username and PIN.')
    expect(notice).toHaveTextContent('tap Allow')
    expect(notice).not.toHaveTextContent("We've moved")
  })

  it('adds the moved line when they were redirected from the old domain', () => {
    render(<CheckInLoginNotice next={`${TAG_LINK}&moved=1`} />)
    expect(screen.getByTestId('checkin-login-notice')).toHaveTextContent("We've moved to app.thesolarcampus.com.")
  })
})
