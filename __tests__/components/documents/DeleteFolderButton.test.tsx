import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteFolderButton } from '@/app/documents/[folderId]/DeleteFolderButton'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

const deleteFolderMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  deleteFolder: (...args: any[]) => deleteFolderMock(...args),
}))

describe('DeleteFolderButton', () => {
  beforeEach(() => {
    pushMock.mockClear()
    deleteFolderMock.mockReset()
  })

  it('does not call deleteFolder when the confirm is dismissed', () => {
    window.confirm = jest.fn(() => false)
    render(<DeleteFolderButton folderId="f1" folderName="Bursary Information" />)
    fireEvent.click(screen.getByLabelText('Delete folder Bursary Information'))
    expect(deleteFolderMock).not.toHaveBeenCalled()
  })

  it('calls deleteFolder and navigates to /documents on success', async () => {
    window.confirm = jest.fn(() => true)
    deleteFolderMock.mockResolvedValue({ ok: true })
    render(<DeleteFolderButton folderId="f1" folderName="Bursary Information" />)
    fireEvent.click(screen.getByLabelText('Delete folder Bursary Information'))
    await waitFor(() => expect(deleteFolderMock).toHaveBeenCalledWith('f1'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/documents'))
  })

  it('shows an error message on failure', async () => {
    window.confirm = jest.fn(() => true)
    deleteFolderMock.mockResolvedValue({ ok: false, error: 'Staff only' })
    render(<DeleteFolderButton folderId="f1" folderName="Bursary Information" />)
    fireEvent.click(screen.getByLabelText('Delete folder Bursary Information'))
    await waitFor(() => expect(screen.getByText('Staff only')).toBeInTheDocument())
  })
})
