import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SquadNumbersPanel, type SquadNumberRow } from '@/components/matches/SquadNumbersPanel'

/**
 * The in-app "Catapult – GPS template": shirt and pod against each name for
 * one match. The GPS import resolves "Tranmere P13" through these pods.
 */
const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const squad: SquadNumberRow[] = [
  { id: 's-blake', name: 'L. Blake', status: 'accepted', shirt_number: null, gps_number: null },
  { id: 's-caleb', name: 'C. McWilliam', status: 'accepted', shirt_number: null, gps_number: null },
  { id: 's-out', name: 'Z. Declined', status: 'declined', shirt_number: null, gps_number: null },
]

const shirt = (name: string) => screen.getByLabelText(`Shirt number for ${name}`) as HTMLInputElement
const pod = (name: string) => screen.getByLabelText(`GPS pod for ${name}`) as HTMLInputElement
const saveButton = () => screen.getByRole('button', { name: /save numbers/i })

beforeEach(() => refreshMock.mockReset())

it('pod follows the shirt number until it is given its own number', () => {
  render(<SquadNumbersPanel squad={squad} save={jest.fn()} />)

  fireEvent.change(shirt('C. McWilliam'), { target: { value: '13' } })
  expect(pod('C. McWilliam').value).toBe('13')

  fireEvent.change(pod('C. McWilliam'), { target: { value: '7' } })
  fireEvent.change(shirt('C. McWilliam'), { target: { value: '14' } })
  expect(pod('C. McWilliam').value).toBe('7')
})

it('blocks saving while two players share a pod', () => {
  render(<SquadNumbersPanel squad={squad} save={jest.fn()} />)

  fireEvent.change(shirt('L. Blake'), { target: { value: '1' } })
  fireEvent.change(shirt('C. McWilliam'), { target: { value: '2' } })
  fireEvent.change(pod('C. McWilliam'), { target: { value: '1' } })

  expect(saveButton()).toBeDisabled()
  expect(screen.getByText(/two players share a number/i)).toBeInTheDocument()
})

it('blocks saving a number outside 1–99', () => {
  render(<SquadNumbersPanel squad={squad} save={jest.fn()} />)

  fireEvent.change(shirt('L. Blake'), { target: { value: '100' } })

  expect(saveButton()).toBeDisabled()
})

it('auto-numbers the players who are going and leaves the declined one blank', () => {
  render(<SquadNumbersPanel squad={squad} save={jest.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: /auto-number 1…2/i }))

  expect([shirt('L. Blake').value, shirt('C. McWilliam').value].sort()).toEqual(['1', '2'])
  expect(pod('L. Blake').value).toBe(shirt('L. Blake').value)
  expect(shirt('Z. Declined').value).toBe('')
})

it('saves every squad row with its shirt and pod', async () => {
  const save = jest.fn().mockResolvedValue({ ok: true })
  render(<SquadNumbersPanel squad={squad} save={save} />)

  fireEvent.change(shirt('C. McWilliam'), { target: { value: '13' } })
  fireEvent.click(saveButton())

  await waitFor(() => expect(screen.getByText('Numbers saved')).toBeInTheDocument())
  expect(save).toHaveBeenCalledWith(expect.arrayContaining([
    { squadId: 's-caleb', shirt: 13, gps: 13 },
    { squadId: 's-blake', shirt: null, gps: null },
    { squadId: 's-out', shirt: null, gps: null },
  ]))
  expect(refreshMock).toHaveBeenCalled()
})

it('shows the reason when the server refuses', async () => {
  const save = jest.fn().mockResolvedValue({ ok: false, error: 'That number is already used by another player in this match' })
  render(<SquadNumbersPanel squad={squad} save={save} />)

  fireEvent.click(saveButton())

  expect(await screen.findByText('That number is already used by another player in this match')).toBeInTheDocument()
})
