'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera } from 'lucide-react'
import { updateCourse, uploadAvatar } from './actions'

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
  const [courseId, setCourseId] = useState(profile.course_id ?? '')
  const [, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = profile.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('avatar', file)
    startTransition(async () => {
      const result = await uploadAvatar(formData)
      if (result && 'url' in result && result.url) {
        setAvatarUrl(result.url)
      }
      setUploading(false)
    })
  }

  function handleCourseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    setCourseId(value)
    startTransition(async () => {
      await updateCourse(value)
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tranmere-blue">Profile</h1>

      {/* Avatar */}
      <div className="flex justify-center">
        <div className="relative cursor-pointer" onClick={handleAvatarClick}>
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-300 flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-2xl font-bold">{initials}</span>
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-tranmere-blue rounded-full p-1">
            <Camera size={12} className="text-white" />
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <span className="text-white text-xs">...</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
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
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs text-muted-foreground font-medium">Course</span>
          <select
            value={courseId}
            onChange={handleCourseChange}
            className="text-sm font-medium text-right border-none outline-none bg-transparent cursor-pointer"
          >
            <option value="">None assigned</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-xs text-muted-foreground font-medium">Role</span>
          <span className="text-sm font-medium text-right">
            {profile.role
              ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
