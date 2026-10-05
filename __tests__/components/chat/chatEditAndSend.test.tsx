import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { ChatThread } from '@/app/chat/[roomId]/ChatThread'
import { MessageReactionSheet } from '@/components/chat/MessageReactionSheet'
import type { ChatMessage } from '@/lib/chat/types'

const ROOM_ID = 'room-1'
const ME = 'coach-1'

Element.prototype.scrollTo = jest.fn()
Element.prototype.scrollIntoView = jest.fn()

jest.mock('@/app/chat/actions', () => ({
  markRead: jest.fn(),
  notifyRoomMembers: jest.fn(() => Promise.resolve()),
  createPoll: jest.fn(),
  closePoll: jest.fn(),
}))

// jsdom never fires load events on <img>, so the real compressor would hang
// the send. Its own behaviour is covered in compressChatImage.test.ts.
jest.mock('@/lib/chat/compressImage', () => ({
  compressChatImage: jest.fn((f: File) => Promise.resolve(f)),
}))

const insertMock = jest.fn()
const updateMock = jest.fn()
const uploadMock = jest.fn()

interface ChannelMock {
  on: jest.Mock
  subscribe: jest.Mock
  track: jest.Mock
  presenceState: jest.Mock
}
const channelMock: ChannelMock = {
  on: jest.fn(() => channelMock),
  subscribe: jest.fn(() => channelMock),
  track: jest.fn(() => Promise.resolve()),
  presenceState: jest.fn(() => ({})),
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => channelMock,
    removeChannel: jest.fn(),
    from: (table: string) => {
      if (table !== 'chat_messages') throw new Error(`Unexpected table: ${table}`)
      return {
        insert: (row: unknown) => ({ select: () => ({ single: () => insertMock(row) }) }),
        update: (patch: unknown) => ({ eq: (_c: string, id: string) => ({ select: () => ({ single: () => updateMock(patch, id) }) }) }),
      }
    },
    storage: { from: () => ({ upload: uploadMock, createSignedUrl: jest.fn(() => Promise.resolve({ data: null })) }) },
  }),
}))

const recent = (): ChatMessage => ({
  id: 'm1', sender_id: ME, body: 'Trainng at 10', attachment_url: null, attachment_kind: null,
  created_at: new Date().toISOString(), reply_to_id: null, poll_id: null, edited_at: null,
})

function renderThread(initialMessages: ChatMessage[] = []) {
  return render(
    <ChatThread
      roomId={ROOM_ID}
      roomKind="group"
      currentUserId={ME}
      initialMessages={initialMessages}
      members={[{ user_id: ME, users: { id: ME, name: 'Coach', avatar_url: null } }]}
    />
  )
}

beforeEach(() => {
  insertMock.mockReset()
  updateMock.mockReset()
  uploadMock.mockReset()
  channelMock.on.mockClear()
  window.alert = jest.fn()
  window.confirm = jest.fn(() => true)
  global.URL.createObjectURL = jest.fn(() => 'blob:preview')
})

describe('MessageReactionSheet — Edit option', () => {
  const base = { deleting: false, onPick: jest.fn(), onReply: jest.fn(), onDelete: jest.fn(), onClose: jest.fn() }

  it('offers Edit on my own message inside the edit window', () => {
    const onEdit = jest.fn()
    render(<MessageReactionSheet {...base} mine canEdit onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('hides Edit when the window has passed or the message is not mine', () => {
    const { rerender } = render(<MessageReactionSheet {...base} mine canEdit={false} onEdit={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    rerender(<MessageReactionSheet {...base} mine={false} canEdit onEdit={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })
})

describe('ChatThread — sending a photo', () => {
  async function attachPhoto() {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })
  }

  it('enables the send arrow once a photo is attached, with no text', async () => {
    renderThread()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await attachPhoto()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })

  it('keeps the photo and re-enables send when the upload fails, and sends nothing', async () => {
    uploadMock.mockResolvedValue({ data: null, error: { message: 'Network request failed' } })
    renderThread()
    await attachPhoto()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })) })
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Network request failed'))
    expect(insertMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
    expect(document.querySelector('img[src="blob:preview"]')).not.toBeNull()
  })

  it('does not leave the send arrow stuck when the upload throws', async () => {
    uploadMock.mockRejectedValue(new Error('offline'))
    renderThread()
    await attachPhoto()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })) })
    expect(window.alert).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })

  it('uploads then inserts the message with the image attached', async () => {
    uploadMock.mockResolvedValue({ data: { path: `${ME}/1.jpg` }, error: null })
    insertMock.mockResolvedValue({ data: { ...recent(), id: 'sent', body: null, attachment_url: `${ME}/1.jpg`, attachment_kind: 'image' }, error: null })
    renderThread()
    await attachPhoto()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })) })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ attachment_url: `${ME}/1.jpg`, attachment_kind: 'image' }))
    expect(document.querySelector('img[src="blob:preview"]')).toBeNull()
  })
})

describe('ChatThread — editing a message', () => {
  async function openEdit() {
    fireEvent.contextMenu(screen.getByText('Trainng at 10'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })) })
  }

  it('saves the edited text and marks the bubble as edited', async () => {
    updateMock.mockResolvedValue({ data: { id: 'm1', body: 'Training at 10', edited_at: new Date().toISOString() }, error: null })
    renderThread([recent()])
    await openEdit()
    const textarea = screen.getByPlaceholderText('Message…') as HTMLTextAreaElement
    expect(textarea.value).toBe('Trainng at 10')
    fireEvent.change(textarea, { target: { value: 'Training at 10' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save edit' })) })
    expect(updateMock).toHaveBeenCalledWith({ body: 'Training at 10' }, 'm1')
    expect(insertMock).not.toHaveBeenCalled()
    expect(screen.getByText('Training at 10')).toBeInTheDocument()
    expect(screen.getByText('edited')).toBeInTheDocument()
    expect(textarea.value).toBe('')
  })

  it('keeps the edit open and shows the database refusal', async () => {
    updateMock.mockResolvedValue({ data: null, error: { message: 'Messages can only be edited for 15 minutes after sending' } })
    renderThread([recent()])
    await openEdit()
    fireEvent.change(screen.getByPlaceholderText('Message…'), { target: { value: 'Training at 11' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save edit' })) })
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('15 minutes'))
    expect(screen.getByText('Editing message')).toBeInTheDocument()
  })

  it('does not offer Edit on a message older than 15 minutes', () => {
    renderThread([{ ...recent(), created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString() }])
    fireEvent.contextMenu(screen.getByText('Trainng at 10'))
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('applies an edit made on another device via Realtime', async () => {
    renderThread([recent()])
    const updateCall = channelMock.on.mock.calls.find(
      c => c[0] === 'postgres_changes' && (c[1] as { event: string; table: string }).event === 'UPDATE'
        && (c[1] as { table: string }).table === 'chat_messages',
    )
    const handler = updateCall![2] as (p: { new: Record<string, unknown> }) => void
    await act(async () => {
      handler({ new: { ...recent(), body: 'Training at 10', edited_at: new Date().toISOString(), deleted_at: null } })
    })
    const bubble = screen.getByText('Training at 10').closest('div')!
    expect(within(bubble.parentElement!).getByText('edited')).toBeInTheDocument()
  })
})
