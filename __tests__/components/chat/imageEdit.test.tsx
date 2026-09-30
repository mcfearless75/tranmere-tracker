import { render, screen, act, fireEvent } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'

Element.prototype.scrollTo = jest.fn()

jest.mock('@/app/chat/actions', () => ({ markRead: jest.fn(() => Promise.resolve(null)), notifyRoomMembers: jest.fn() }))

// The real cropper needs layout/canvas jsdom doesn't have. The stand-in
// reports a crop area when its button is pressed, standing in for the real
// one's report after the image loads.
jest.mock('react-easy-crop', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react')
  return {
    __esModule: true,
    default: ({ onCropComplete }: { onCropComplete: (a: unknown, p: unknown) => void }) =>
      React.createElement('button', {
        'data-testid': 'cropper',
        onClick: () => onCropComplete({}, { x: 0, y: 0, width: 10, height: 10 }),
      }),
  }
})

const edited = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
jest.mock('@/lib/chat/cropImage', () => ({
  ...jest.requireActual('@/lib/chat/cropImage'),
  cropImage: jest.fn(() => Promise.resolve(edited)),
}))

const channel: Record<string, jest.Mock> = {}
Object.assign(channel, {
  on: jest.fn(() => channel),
  subscribe: jest.fn(() => channel),
  track: jest.fn(() => Promise.resolve()),
  send: jest.fn(),
  presenceState: jest.fn(() => ({})),
})
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => channel,
    removeChannel: jest.fn(),
    from: () => { throw new Error('unexpected') },
    storage: { from: () => ({ createSignedUrl: jest.fn() }) },
  }),
}))

beforeAll(() => {
  let n = 0
  global.URL.createObjectURL = jest.fn(() => `blob:${++n}`)
  global.URL.revokeObjectURL = jest.fn()
})

function renderThread() {
  return render(
    <ChatThread roomId="r" roomKind="custom" currentUserId="me"
      members={[{ user_id: 'me', users: { id: 'me', name: 'Coach', avatar_url: null } }]}
      initialMessages={[]} />,
  )
}

function pick(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

it('opens the editor for a photo and swaps in the edited image on Done', async () => {
  await act(async () => { renderThread() })
  await act(async () => { pick(new File(['p'], 'IMG_1.png', { type: 'image/png' })) })
  expect(screen.getByRole('dialog', { name: 'Edit photo' })).toBeInTheDocument()

  await act(async () => { fireEvent.click(screen.getByTestId('cropper')) })
  await act(async () => { fireEvent.click(screen.getByLabelText('Done editing')) })
  expect(screen.queryByRole('dialog', { name: 'Edit photo' })).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1')
  expect(screen.getByLabelText('Edit photo')).toBeInTheDocument()
})

it('Cancel keeps the original photo attached', async () => {
  await act(async () => { renderThread() })
  await act(async () => { pick(new File(['p'], 'IMG_2.jpg', { type: 'image/jpeg' })) })
  await act(async () => { fireEvent.click(screen.getByLabelText('Cancel editing')) })
  expect(screen.queryByRole('dialog', { name: 'Edit photo' })).toBeNull()
  expect(screen.getByLabelText('Edit photo')).toBeInTheDocument()
})

it('does not open the editor for a PDF', async () => {
  await act(async () => { renderThread() })
  await act(async () => { pick(new File(['p'], 'plan.pdf', { type: 'application/pdf' })) })
  expect(screen.queryByRole('dialog', { name: 'Edit photo' })).toBeNull()
  expect(screen.queryByLabelText('Edit photo')).toBeNull()
  expect(screen.getByText('plan.pdf')).toBeInTheDocument()
})
