import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DocumentList } from '@/app/documents/[folderId]/DocumentList'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const deleteDocumentMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  deleteDocument: (...args: any[]) => deleteDocumentMock(...args),
}))

const docs = [
  { id: 'd1', name: 'Handbook.pdf', mime_type: 'application/pdf', size_bytes: 204800, url: 'https://example.com/handbook.pdf' },
  { id: 'd2', name: 'Logo.png', mime_type: 'image/png', size_bytes: 5000, url: null },
]

describe('DocumentList', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    deleteDocumentMock.mockReset()
  })

  it('renders file names and sizes', () => {
    render(<DocumentList documents={docs} isStaff={false} />)
    expect(screen.getByText('Handbook.pdf')).toBeInTheDocument()
    expect(screen.getByText('200 KB')).toBeInTheDocument()
  })

  it('shows a download link only when a url is available', () => {
    render(<DocumentList documents={docs} isStaff={false} />)
    expect(screen.getByLabelText('Download Handbook.pdf')).toBeInTheDocument()
    expect(screen.queryByLabelText('Download Logo.png')).not.toBeInTheDocument()
  })

  it('shows no delete controls for a non-staff viewer', () => {
    render(<DocumentList documents={docs} isStaff={false} />)
    expect(screen.queryByLabelText(/Delete/)).not.toBeInTheDocument()
  })

  it('shows delete controls for staff and calls deleteDocument on confirm', async () => {
    window.confirm = jest.fn(() => true)
    deleteDocumentMock.mockResolvedValue({ ok: true })
    render(<DocumentList documents={docs} isStaff={true} />)
    fireEvent.click(screen.getByLabelText('Delete Handbook.pdf'))
    expect(deleteDocumentMock).toHaveBeenCalledWith('d1')
    // Wait for the transition's resolution (setRemovingId + router.refresh) to
    // settle inside act() — otherwise React logs an "update not wrapped in
    // act()" warning for the state update that lands after this callback body
    // would otherwise have already returned.
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('renders an empty state when there are no files', () => {
    render(<DocumentList documents={[]} isStaff={false} />)
    expect(screen.getByText('No files in this folder yet.')).toBeInTheDocument()
  })
})
