import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateFolderButton } from '@/app/documents/CreateFolderButton'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const createFolderMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  createFolder: (...args: any[]) => createFolderMock(...args),
}))

describe('CreateFolderButton', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    createFolderMock.mockReset()
  })

  it('opens the form on click', () => {
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    expect(screen.getByPlaceholderText(/Folder name/)).toBeInTheDocument()
  })

  it('shows an error instead of submitting when no name is entered', () => {
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    fireEvent.click(screen.getByText('Create folder'))
    expect(screen.getByText('Give the folder a name')).toBeInTheDocument()
    expect(createFolderMock).not.toHaveBeenCalled()
  })

  // createFolder took a second `parentId` argument when nested folders
  // landed (1acd121). At the top level the button has no parent, so it
  // forwards `undefined` — asserted explicitly so a future change that
  // silently drops the argument shows up here.
  it('submits the trimmed name and refreshes on success', async () => {
    createFolderMock.mockResolvedValue('folder-123')
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    fireEvent.change(screen.getByPlaceholderText(/Folder name/), { target: { value: '  Bursary Information  ' } })
    fireEvent.click(screen.getByText('Create folder'))
    await waitFor(() => expect(createFolderMock).toHaveBeenCalledWith('Bursary Information', undefined))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('creates a subfolder under the parent it was given', async () => {
    createFolderMock.mockResolvedValue('folder-456')
    render(<CreateFolderButton parentId="parent-1" />)
    fireEvent.click(screen.getByText('New subfolder'))
    fireEvent.change(screen.getByPlaceholderText(/Subfolder name/), { target: { value: 'Payslips' } })
    fireEvent.click(screen.getByText('Create subfolder'))
    await waitFor(() => expect(createFolderMock).toHaveBeenCalledWith('Payslips', 'parent-1'))
  })

  it('shows the server error message on failure', async () => {
    createFolderMock.mockResolvedValue({ error: 'Staff only' })
    render(<CreateFolderButton />)
    fireEvent.click(screen.getByText('New folder'))
    fireEvent.change(screen.getByPlaceholderText(/Folder name/), { target: { value: 'Test' } })
    fireEvent.click(screen.getByText('Create folder'))
    await waitFor(() => expect(screen.getByText('Staff only')).toBeInTheDocument())
  })
})
