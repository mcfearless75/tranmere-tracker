import type { TeamRef } from '@/lib/teams/types'

/**
 * Small pill naming a player's team, sibling to YearBadge.
 *
 * Colour is derived from the team id rather than its name, so renaming a team
 * keeps its colour and a newly added fourth team gets a distinct one without
 * anybody editing a hardcoded map.
 */

const PALETTE = [
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
]

function paletteFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

type Props = {
  team: TeamRef | null | undefined
  className?: string
}

export function TeamBadge({ team, className = '' }: Props) {
  if (!team) return null
  return (
    <span
      title={`${team.name} team`}
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 ${paletteFor(team.id)} ${className}`}
    >
      {team.name}
    </span>
  )
}
