import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DocumentList } from '@/app/documents/[folderId]/DocumentList'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const deleteDocumentMock = jest.fn()
const moveDocumentMock = jest.fn()
const renameDocumentMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  deleteDocument: (...args: any[]) => deleteDocumentMock(...args),
  moveDocument: (...args: any[]) => moveDocumentMock(...args),
  renameDocument: (...args: any[]) => renameDocumentMock(...args),
}))

const docs = [
  { id: 'd1', name: 'Handbook.pdf', mime_type: 'application/pdf', size_bytes: 204800, url: 'https://example.com/handbook.pdf' },
  { id: 'd2', name: 'Logo.png', mime_type: 'image/png', size_bytes: 5000, url: null },
]

// `destinations` is the list of other folders a staff member can move a file
// into — added with nested folders (a1cc00d). It is a required prop with a
// single call site that always supplies it, so the default here is the
// common case (no sibling folders) rather than a stand-in for "missing".
function renderList(props: Partial<React.ComponentProps<typeof DocumentList>> = {}) {
  return render(<DocumentList documents={docs} isStaff={false} destinations={[]} {...props} />)
}

describe('DocumentList', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    deleteDocumentMock.mockReset()
    moveDocumentMock.mockReset()
    renameDocumentMock.mockReset()
  })

  it('renders file names and sizes', () => {
    renderList()
    expect(screen.getByText('Handbook.pdf')).toBeInTheDocument()
    expect(screen.getByText('200 KB')).toBeInTheDocument()
  })

  // Every row shows the same visible words ("View", "Download", "Delete"…),
  // so the per-file accessible name is the only thing telling them apart for
  // a screen-reader user scanning a folder of twenty files.
  it('shows a download link only when a url is available', () => {
    renderList()
    expect(screen.getByLabelText('Download Handbook.pdf')).toBeInTheDocument()
    expect(screen.queryByLabelText('Download Logo.png')).not.toBeInTheDocument()
  })

  it('shows no delete controls for a non-staff viewer', () => {
    renderList()
    expect(screen.queryByLabelText(/^Delete /)).not.toBeInTheDocument()
  })

  it('shows delete controls for staff and calls deleteDocument on confirm', async () => {
    window.confirm = jest.fn(() => true)
    deleteDocumentMock.mockResolvedValue({ ok: true })
    renderList({ isStaff: true })
    fireEvent.click(screen.getByLabelText('Delete Handbook.pdf'))
    expect(deleteDocumentMock).toHaveBeenCalledWith('d1')
    // Wait for the transition's resolution (setRemovingId + router.refresh) to
    // settle inside act() — otherwise React logs an "update not wrapped in
    // act()" warning for the state update that lands after this callback body
    // would otherwise have already returned.
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('offers Move to staff only when there is somewhere to move a file to', () => {
    renderList({ isStaff: true })
    expect(screen.queryByLabelText('Move Handbook.pdf')).not.toBeInTheDocument()

    renderList({ isStaff: true, destinations: [{ id: 'f2', name: 'Bursary Information' }] })
    expect(screen.getAllByLabelText('Move Handbook.pdf')[0]).toBeInTheDocument()
  })

  it('moves a file into the folder picked from the Move sheet', async () => {
    moveDocumentMock.mockResolvedValue({ ok: true })
    renderList({ isStaff: true, destinations: [{ id: 'f2', name: 'Bursary Information' }] })
    fireEvent.click(screen.getByLabelText('Move Handbook.pdf'))
    fireEvent.click(screen.getByText('Bursary Information'))
    expect(moveDocumentMock).toHaveBeenCalledWith('d1', 'f2')
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('renders an empty state when there are no files', () => {
    renderList({ documents: [] })
    expect(screen.getByText('No files in this folder yet.')).toBeInTheDocument()
  })
})
