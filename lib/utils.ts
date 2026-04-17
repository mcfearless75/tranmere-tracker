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
