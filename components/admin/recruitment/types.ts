import { ProspectStatus } from '@/lib/recruitment/recruitmentUtils'

export type ProspectRow = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  position: string | null
  preferred_foot: string | null
  current_club: string | null
  contact_email: string
  contact_phone: string | null
  parent_guardian_name: string
  consent_given: boolean
  notes: string | null
  source: string
  status: ProspectStatus
  created_at: string
  updated_at: string
}

export type TrialEventRow = {
  id: string
  title: string
  event_date: string
  location: string | null
  notes: string | null
  created_at: string
}

export type TrialAttendeeRow = {
  id: string
  trial_event_id: string
  prospect_id: string
  attended: boolean
  rating: number | null
  scout_notes: string | null
}

export type ProspectNoteRow = {
  id: string
  prospect_id: string
  author_id: string
  note: string
  created_at: string
}

/** A prospect's attendance at a trial, joined with the event details. */
export type ProspectTrialHistory = {
  id: string
  attended: boolean
  rating: number | null
  scout_notes: string | null
  eventTitle: string
  eventDate: string
}
