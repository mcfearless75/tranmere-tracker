// Single source of truth for student-facing navigation destinations.
//
// SideNav (desktop) and BottomNav (mobile "More" sheet) used to keep their
// own hand-written lists. They drifted apart over time — the mobile list
// gained Gym/Targets/Wellbeing without SideNav, and picked up Chat, Calendar
// but SideNav never got Nutrition/Moodle/Training/Matches/AI Report/Calendar
// mirrored in reverse — students on phones had no way to reach Nutrition,
// Moodle, Training, Matches, or AI Report, and desktop students had no way
// to reach Calendar, Gym, Targets, or Wellbeing. This module is the one
// place both navs read from, so a new destination only has to be added once.
import type { LucideIcon } from 'lucide-react'
import {
  Home,
  User,
  Heart,
  CalendarDays,
  CalendarClock,
  Dumbbell,
  Target,
  FolderOpen,
  ClipboardCheck,
  MessageSquare,
  GraduationCap,
  Apple,
  Trophy,
  Brain,
  Route,
} from 'lucide-react'
import { MOODLE_STUDENT_URL } from '@/lib/config/moodle'

export type StudentNavItem = {
  href: string
  label: string
  icon: LucideIcon
  external?: boolean
  requires?: 'timetable' | 'coursework'
}

export type StudentNavFlags = {
  showTimetable?: boolean
  showCoursework?: boolean
}

// The 4 tabs mobile always keeps visible (BottomNav's own primary row).
// Desktop has no such row — it renders STUDENT_NAV_ALL in full.
export const STUDENT_NAV_PRIMARY: StudentNavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/profile', label: 'Profile', icon: User },
]

// Every student destination, in the order both navs display it. Desktop
// renders this list as-is; mobile renders whatever's left after removing
// STUDENT_NAV_PRIMARY's hrefs (see resolveStudentNavExtra).
export const STUDENT_NAV_ALL: StudentNavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/documents', label: 'Documents', icon: FolderOpen },
  { href: '/timetable', label: 'Timetable', icon: CalendarClock, requires: 'timetable' },
  { href: '/coursework', label: 'Coursework', icon: ClipboardCheck, requires: 'coursework' },
  { href: MOODLE_STUDENT_URL, label: 'Moodle', icon: GraduationCap, external: true },
  { href: '/nutrition', label: 'Nutrition', icon: Apple },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/training', label: 'Training', icon: Dumbbell },
  { href: '/gps', label: 'GPS', icon: Route },
  { href: '/gym', label: 'Gym', icon: Dumbbell },
  { href: '/matches', label: 'Matches', icon: Trophy },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/ai-report', label: 'AI Report', icon: Brain },
  { href: '/targets', label: 'Targets', icon: Target },
  { href: '/wellbeing', label: 'Wellbeing', icon: Heart },
  { href: '/profile', label: 'Profile', icon: User },
]

function applyFlags(items: StudentNavItem[], flags: StudentNavFlags): StudentNavItem[] {
  return items.filter(item => {
    if (item.requires === 'timetable') return !!flags.showTimetable
    if (item.requires === 'coursework') return !!flags.showCoursework
    return true
  })
}

/** Full desktop nav order, with Timetable/Coursework included per flags. */
export function resolveStudentNavAll(flags: StudentNavFlags): StudentNavItem[] {
  return applyFlags(STUDENT_NAV_ALL, flags)
}

/** Mobile's overflow ("More") list: everything not already in the primary row. */
export function resolveStudentNavExtra(flags: StudentNavFlags): StudentNavItem[] {
  const primaryHrefs = new Set(STUDENT_NAV_PRIMARY.map(item => item.href))
  return applyFlags(STUDENT_NAV_ALL, flags).filter(item => !primaryHrefs.has(item.href))
}
