'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Upload, Check } from 'lucide-react'
import { updateCourse, uploadAvatar } from './actions'
import { isHeicFile } from '@/lib/media/heic'

interface Course {
  id: string
  name: string
}

interface ProfileClientProps {
  profile: {
    id: string
    name: string | null
    email: string | null
    role: string | null
    course_id: string | null
    avatar_url: string | null
    courses: { name: string } | null
  }
  courses: Course[]
}

export function ProfileClient({ profile, courses }: ProfileClientProps) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<'converting' | 'uploading'>('uploading')
  const [uploadError, setUploadError] = useState('')
  const [courseId, setCourseId] = useState(profile.course_id ?? '')
  const [courseSaved, setCourseSaved] = useState(false)
  const [courseError, setCourseError] = useState('')
  const [, startTransition] = useTransition()

  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  async function handleFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setUploadError('')

    let uploadFile = file
    // iPhones default to HEIC, which almost no non-Apple browser can render
    // in an <img> tag. Convert to JPEG in the browser before it ever reaches
    // the server — heic2any is a pure-JS/WASM decoder, no native binary
    // needed, so this works the same in serverless as it does locally.
    if (isHeicFile(file)) {
      setUploadStage('converting')
      try {
        const heic2any = (await import('heic2any')).default
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
        const blob = Array.isArray(converted) ? converted[0] : converted
        uploadFile = new File(
          [blob],
          file.name.replace(/\.hei[cf]$/i, '.jpg'),
          { type: 'image/jpeg' }
        )
      } catch {
        setUploadError('Could not process that photo — try a different one, or turn off "High Efficiency" in your camera settings.')
        setUploading(false)
        return
      }
    }

    setUploadStage('uploading')
    const fd = new FormData()
    fd.append('avatar', uploadFile)
    startTransition(async () => {
      const res = await uploadAvatar(fd)
      if (res && 'url' in res && res.url) {
        setAvatarUrl(res.url)
      } else if (res && 'error' in res && res.error) {
        setUploadError(res.error)
      }
      setUploading(false)
    })
  }

  function handleCourseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    setCourseId(value)
    setCourseError('')
    setCourseSaved(false)
    startTransition(async () => {
      const res = await updateCourse(value)
      if (res?.error) {
        setCourseError(res.error)
      } else {
        setCourseSaved(true)
        setTimeout(() => setCourseSaved(false), 2000)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-tranmere-blue to-blue-900 flex items-center justify-center ring-4 ring-white shadow-lg">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-3xl font-bold">{initials}</span>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <span className="text-white text-xs animate-pulse text-center px-2">
                {uploadStage === 'converting' ? 'Processing…' : 'Uploading…'}
              </span>
            </div>
          )}
        </div>

        {uploadError && (
          <p className="text-xs text-red-600 text-center max-w-xs">{uploadError}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full bg-tranmere-blue text-white px-4 py-2 text-xs font-semibold shadow hover:bg-blue-900"
          >
            <Camera size={14} /> Take Selfie
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full bg-white border-2 border-tranmere-blue text-tranmere-blue px-4 py-2 text-xs font-semibold hover:bg-blue-50"
          >
            <Upload size={14} /> Choose Photo
          </button>
        </div>

        {/* Camera-only input (front-facing on mobile) */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
        />
        {/* Gallery input */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Fields */}
      <div className="bg-white rounded-xl border divide-y">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs text-muted-foreground font-medium">Name</span>
          <span className="text-sm font-medium text-right">{profile.name ?? '—'}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs text-muted-foreground font-medium">Email</span>
          <span className="text-sm font-medium text-right">{profile.email ?? '—'}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3 gap-3">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Course</span>
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            {courseSaved && <Check size={14} className="text-green-600" />}
            <select
              value={courseId}
              onChange={handleCourseChange}
              className="text-sm font-medium text-right border-none outline-none bg-transparent cursor-pointer max-w-full"
            >
              <option value="">None assigned</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        {courseError && (
          <div className="px-4 py-2 bg-red-50 text-xs text-red-600">{courseError}</div>
        )}
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs text-muted-foreground font-medium">Role</span>
          <span className="text-sm font-medium text-right capitalize">
            {profile.role ?? '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
