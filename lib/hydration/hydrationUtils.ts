export const DAILY_GOAL_ML = 2500

export interface HydrationLog {
  amount_ml: number
}

/** Sum all intake amounts from a list of logs */
export function totalIntake(logs: HydrationLog[]): number {
  return logs.reduce((sum, log) => sum + log.amount_ml, 0)
}

/** Progress percentage toward goal, capped at 100 */
export function progressPct(totalMl: number, goalMl: number = DAILY_GOAL_ML): number {
  if (goalMl <= 0) return 0
  return Math.min(100, Math.round((totalMl / goalMl) * 100))
}

/** Human-readable label e.g. "1.2L of 2.5L" */
export function intakeLabel(totalMl: number, goalMl: number = DAILY_GOAL_ML): string {
  const totalL = (totalMl / 1000).toFixed(1)
  const goalL = (goalMl / 1000).toFixed(1)
  return `${totalL}L of ${goalL}L`
}
