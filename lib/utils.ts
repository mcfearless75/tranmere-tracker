import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted' | 'graded'

export function getStatusLabel(status: SubmissionStatus): string {
  const map: Record<SubmissionStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    graded: 'Graded',
  }
  return map[status]
}

export function getStatusColor(status: SubmissionStatus): string {
  const map: Record<SubmissionStatus, string> = {
    not_started: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-blue-100 text-blue-700',
    graded: 'bg-green-100 text-green-700',
  }
  return map[status]
}

type MacroEntry = { calories: number; protein_g: number; carbs_g: number; fat_g: number }

export function sumMacros(logs: MacroEntry[]) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein_g: acc.protein_g + Number(l.protein_g),
      carbs_g: acc.carbs_g + Number(l.carbs_g),
      fat_g: acc.fat_g + Number(l.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}
