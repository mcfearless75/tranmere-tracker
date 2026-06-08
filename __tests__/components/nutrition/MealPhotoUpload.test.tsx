import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MealPhotoUpload } from '@/components/nutrition/MealPhotoUpload'
import { validateImageFile, compressImage, MAX_UPLOAD_BYTES } from '@/components/nutrition/mealPhoto'

// --- Mocks for browser-only / external dependencies ---------------------

const refresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}))

const insert = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: () => ({ insert: (...args: unknown[]) => insert(...args) }) }),
}))

function makeImageFile(name = 'plate.jpg', type = 'image/jpeg', size = 1024): File {
  const file = new File(['x'.repeat(8)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  jest.clearAllMocks()
  // jsdom does not implement these.
  global.URL.createObjectURL = jest.fn(() => 'blob:preview')
  // Force compressImage to fall back to the original file (no canvas in jsdom).
  // @ts-expect-error -- deliberately remove for the fallback path
  global.createImageBitmap = undefined
})

// --- Pure helper tests --------------------------------------------------

describe('validateImageFile', () => {
  it('accepts a normal image file', () => {
    expect(validateImageFile(makeImageFile())).toEqual({ ok: true })
  })

  it('rejects a non-image file', () => {
    const result = validateImageFile(makeImageFile('notes.pdf', 'application/pdf'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not an image/i)
  })

  it('rejects an oversized image', () => {
    const result = validateImageFile(makeImageFile('huge.jpg', 'image/jpeg', MAX_UPLOAD_BYTES + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/too large/i)
  })
})

describe('compressImage', () => {
  it('returns the original file when the browser cannot decode images', async () => {
    const file = makeImageFile()
    await expect(compressImage(file)).resolves.toBe(file)
  })
})

// --- Component render + interaction -------------------------------------

describe('MealPhotoUpload', () => {
  it('renders the capture prompt', () => {
    render(<MealPhotoUpload studentId="s1" />)
    expect(screen.getByRole('button', { name: /take a photo or upload/i })).toBeInTheDocument()
  })

  it('shows an error and never calls the API for a non-image file', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch')
    const { container } = render(<MealPhotoUpload studentId="s1" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [makeImageFile('doc.pdf', 'application/pdf')] } })

    expect(await screen.findByText(/not an image/i)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('uploads an image, renders the AI estimate, and logs the meal', async () => {
    const estimate = {
      food_name: 'Chicken and rice',
      meal_type: 'lunch',
      calories: 550,
      protein_g: 40,
      carbs_g: 60,
      fat_g: 12,
      confidence: 'high',
      notes: 'Great post-training meal.',
    }
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, estimate }),
    }) as unknown as typeof fetch

    const { container } = render(<MealPhotoUpload studentId="s1" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [makeImageFile()] } })

    expect(await screen.findByText('Chicken and rice')).toBeInTheDocument()
    expect(screen.getByText(/high confidence/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /log this meal/i }))

    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: 's1',
        meal_type: 'lunch',
        food_name: 'Chicken and rice',
        calories: 550,
      }),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('surfaces an API error message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ error: 'AI request failed' }),
    }) as unknown as typeof fetch

    const { container } = render(<MealPhotoUpload studentId="s1" />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [makeImageFile()] } })

    expect(await screen.findByText(/ai request failed/i)).toBeInTheDocument()
  })
})
