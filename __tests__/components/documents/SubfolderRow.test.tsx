import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SubfolderRow } from '@/app/documents/[folderId]/SubfolderRow'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock, push: jest.fn() }) }))

const renameFolderMock = jest.fn()
const moveDocumentMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  renameFolder: (...a: any[]) => renameFolderMock(...a),
  moveDocument: (...a: any[]) => moveDocumentMock(...a),
}))

function renderRow() {
  return render(<SubfolderRow id="f1" name="Bursaries" isStaff />)
}

function startRename(to: string) {
  fireEvent.click(screen.getByLabelText('Rename folder'))
  fireEvent.change(screen.getByDisplayValue('Bursaries'), { target: { value: to } })
  fireEvent.click(screen.getByLabelText('Save folder name'))
}

/**
 * This row used to surface nothing at all: both calls checked `res.ok` and did
 * nothing on the other branch, and neither was wrapped, so a refused rename, a
 * rejected drop and a dropped connection all looked identical — the folder
 * simply did not change and no reason was given.
 */
describe('SubfolderRow reports failures', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    renameFolderMock.mockReset().mockResolvedValue({ ok: true })
    moveDocumentMock.mockReset().mockResolvedValue({ ok: true })
  })

  it('renames and refreshes on success', async () => {
    renderRow()
    startRename('Bursary Information')
    await waitFor(() => expect(renameFolderMock).toHaveBeenCalledWith('f1', 'Bursary Information'))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('shows the returned error instead of silently doing nothing', async () => {
    renameFolderMock.mockResolvedValue({ ok: false, error: 'Staff only' })
    renderRow()
    startRename('Bursary Information')
    expect(await screen.findByText('Staff only')).toBeInTheDocument()
  })

  it('reports a rejected request rather than appearing to do nothing', async () => {
    renameFolderMock.mockRejectedValue(new Error('offline'))
    renderRow()
    startRename('Bursary Information')
    expect(await screen.findByText(/Could not rename/)).toBeInTheDocument()
  })

  it('stays in edit mode on failure so the typed name is not lost', async () => {
    renameFolderMock.mockRejectedValue(new Error('offline'))
    renderRow()
    startRename('Bursary Information')
    await screen.findByText(/Could not rename/)
    expect(screen.getByDisplayValue('Bursary Information')).toBeInTheDocument()
  })

  it('reports a failed drag-and-drop move', async () => {
    moveDocumentMock.mockRejectedValue(new Error('offline'))
    const { container } = renderRow()
    // The droppable element is the inner row, not the wrapper that holds the
    // error line beneath it.
    const row = container.querySelector('.flex.items-center.gap-3.p-3') as HTMLElement
    expect(row).not.toBeNull()

    fireEvent.drop(row, {
      dataTransfer: { getData: (t: string) => (t === 'text/plain' ? 'doc1' : '') },
    })

    expect(await screen.findByText(/Could not move that file/)).toBeInTheDocument()
  })
})
