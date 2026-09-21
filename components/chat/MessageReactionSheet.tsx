'use client'

const QUICK = ['\ud83d\udc4d', '\ud83d\ude02', '\ud83d\ude4f', '\u2764\ufe0f', '\ud83c\udf89', '\ud83d\udd25', '\ud83d\udc4f', '\ud83d\ude2e']

export function MessageReactionSheet({
  mine,
  deleting,
  onPick,
  onDelete,
  onClose,
}: {
  mine: boolean
  deleting: boolean
  onPick: (emoji: string) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-3 mb-8 sm:mb-0 rounded-2xl bg-neutral-900 text-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-1 px-3 py-3 overflow-x-auto">
          {QUICK.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              className="h-10 w-10 shrink-0 text-2xl rounded-full active:bg-white/10"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        {mine && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="w-full border-t border-white/10 px-4 py-3 text-left text-red-400 text-sm font-medium disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
