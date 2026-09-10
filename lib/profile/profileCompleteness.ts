/**
 * Whether a student profile is missing any of the fields coaches/staff
 * actually use (avatar + the six PlayerAttributesForm fields). Backs the
 * "Finish setting up your profile" dashboard nudge — as of 2026-09-10,
 * 29 of 58 students had filled in none of these at all.
 */
export type ProfileAttributes = {
  avatar_url: string | null
  date_of_birth: string | null
  position: string | null
  height_cm: number | null
  weight_kg: number | null
  build: string | null
  dominant_foot: string | null
}

export function isProfileIncomplete(p: ProfileAttributes): boolean {
  return (
    !p.avatar_url ||
    !p.date_of_birth ||
    !p.position ||
    p.height_cm == null ||
    p.weight_kg == null ||
    !p.build ||
    !p.dominant_foot
  )
}
