export type GymLog = {
  exercise: string
  weight_kg: number | null
  sets: number | null
  reps: number | null
  logged_date: string
}

export const COMMON_EXERCISES: string[] = [
  'Squat',
  'Deadlift',
  'Bench Press',
  'Overhead Press',
  'Barbell Row',
  'Pull-ups',
  'Dumbbell Curl',
  'Tricep Dip',
  'Leg Press',
  'Romanian Deadlift',
  'Lat Pulldown',
  'Cable Row',
]

/**
 * Returns the highest weight_kg recorded per exercise.
 * Logs with null weight_kg are ignored.
 */
export function getPersonalBests(logs: GymLog[]): Record<string, number> {
  const pbs: Record<string, number> = {}
  for (const log of logs) {
    if (log.weight_kg === null) continue
    const current = pbs[log.exercise]
    if (current === undefined || log.weight_kg > current) {
      pbs[log.exercise] = log.weight_kg
    }
  }
  return pbs
}

/**
 * Returns a human-readable string for a lift, e.g. "3 sets × 8 reps @ 80kg".
 * Falls back gracefully when sets/reps/weight are null.
 */
export function formatLift(log: GymLog): string {
  if (!log.sets) return ''

  let result = `${log.sets} sets`

  if (log.reps) {
    result += ` × ${log.reps} reps`
  }

  if (log.weight_kg !== null) {
    const kg = Number.isInteger(log.weight_kg) ? log.weight_kg : log.weight_kg
    result += ` @ ${kg}kg`
  }

  return result
}
