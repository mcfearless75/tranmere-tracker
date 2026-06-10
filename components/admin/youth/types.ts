import { HomeAway } from '@/lib/youth/youthUtils'

export type SquadRow = {
  id: string
  name: string
  age_group: string
  coach_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type YouthPlayerRow = {
  id: string
  squad_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  parent_guardian_name: string
  parent_contact_email: string
  parent_contact_phone: string | null
  medical_notes: string | null
  consent_given: boolean
  created_at: string
  updated_at: string
}

export type YouthFixtureRow = {
  id: string
  squad_id: string
  opponent: string
  fixture_date: string
  kick_off: string | null
  location: string | null
  home_away: HomeAway
  result_home: number | null
  result_away: number | null
  notes: string | null
  created_at: string
}

export type CoachOption = {
  id: string
  name: string
}

export type SquadSummary = SquadRow & {
  coachName: string | null
  playerCount: number
  nextFixture: { opponent: string; fixture_date: string } | null
}
