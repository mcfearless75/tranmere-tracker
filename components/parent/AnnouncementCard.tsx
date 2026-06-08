import { Megaphone } from 'lucide-react'
import { type Announcement, formatAnnouncementDate } from './announcementUtils'

interface AnnouncementCardProps {
  announcement: Announcement
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  return (
    <article className="bg-white border rounded-xl p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-tranmere-blue/10 flex items-center justify-center shrink-0 mt-0.5">
          <Megaphone size={14} className="text-tranmere-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{announcement.title}</h2>
            <time className="text-xs text-gray-400 shrink-0" dateTime={announcement.createdAt}>
              {formatAnnouncementDate(announcement.createdAt)}
            </time>
          </div>
          <p className="text-xs text-gray-400 mb-2">{announcement.author}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{announcement.body}</p>
        </div>
      </div>
    </article>
  )
}
