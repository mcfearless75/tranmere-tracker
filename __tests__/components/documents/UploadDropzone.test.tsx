import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UploadDropzone } from '@/app/documents/UploadDropzone'

const refreshMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const recordDocumentMock = jest.fn()
jest.mock('@/app/documents/actions', () => ({
  recordDocument: (...args: any[]) => recordDocumentMock(...args),
}))

const uploadMock = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: (...args: any[]) => uploadMock(...args) }) },
  }),
}))

function makeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('UploadDropzone', () => {
  beforeEach(() => {
    refreshMock.mockClear()
    recordDocumentMock.mockReset()
    uploadMock.mockReset()
  })

  it('rejects a disallowed file type without uploading', async () => {
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('virus.exe', 'application/x-msdownload', 1000)
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('File type not allowed')).toBeInTheDocument()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('rejects an over-size file without uploading', async () => {
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('big.pdf', 'application/pdf', 25 * 1024 * 1024)
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('File is larger than 20MB')).toBeInTheDocument()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('uploads a valid file and records it, then refreshes', async () => {
    uploadMock.mockResolvedValue({ error: null })
    recordDocumentMock.mockResolvedValue({ ok: true })
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('handbook.pdf', 'application/pdf', 1000)
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(uploadMock).toHaveBeenCalled())
    await waitFor(() => expect(recordDocumentMock).toHaveBeenCalledWith('f1', expect.stringContaining('handbook.pdf'), 'handbook.pdf', 'application/pdf', 1000))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('shows an error and does not record when the storage upload fails', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'Network error' } })
    render(<UploadDropzone folderId="f1" />)
    const input = screen.getByLabelText('Upload files')
    const file = makeFile('handbook.pdf', 'application/pdf', 1000)
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(recordDocumentMock).not.toHaveBeenCalled()
  })
})
