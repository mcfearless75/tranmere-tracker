import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ─── STATSports column aliases ───────────────────────────────────────────────
// Covers APEX, APEX Pro, Vivo, and generic exports.
// Keys are what we store; values are possible column header names (lowercased).
const COLUMN_MAP: Record<string, string[]> = {
  player_name:       ['name', 'player name', 'athlete', 'athlete name', 'player'],
  session_date:      ['date', 'session date', 'match date', 'training date'],
  session_label:     ['session', 'session name', 'session type', 'label', 'activity'],
  total_distance_m:  ['total distance (m)', 'total distance(m)', 'total distance', 'distance (m)', 'distance(m)', 'dist (m)'],
  hsr_distance_m:    ['hsr distance (m)', 'hsr (m)', 'high speed running (m)', 'high speed run distance (m)'],
  sprint_distance_m: ['sprint distance (m)', 'sprint dist (m)', 'sprinting distance (m)'],
  max_speed_ms:      ['max velocity (m/s)', 'max speed (m/s)', 'max vel (m/s)'],
  max_speed_kmh:     ['max velocity (km/h)', 'max speed (km/h)', 'max vel (km/h)', 'top speed (km/h)'],
  sprint_count:      ['sprints', 'sprint count', 'number of sprints', 'no. of sprints'],
  accel_count:       ['accelerations', 'accel count', 'accel efforts', 'number of accelerations'],
  decel_count:       ['decelerations', 'decel count', 'decel efforts'],
  player_load:       ['player load', 'pl', 'player load (au)'],
  hr_avg:            ['avg hr', 'average heart rate', 'hr avg', 'mean hr', 'avg heart rate'],
  hr_max:            ['max hr', 'max heart rate', 'hr max', 'peak hr'],
  duration_mins:     ['duration (min)', 'duration (mins)', 'duration', 'time (min)', 'time (mins)', 'elapsed time (mins)'],
}

function mapHeader(raw: string): string | null {
  const lower = raw.trim().toLowerCase()
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    if (aliases.includes(lower)) return field
  }
  return null
}

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseDate(v: string): string | null {
  if (!v) return null
  // Try DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY
  const parts = v.trim().split(/[\/\-]/)
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
    if (parseInt(parts[2]) > 31) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  return null
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const sessionLabel = (form.get('session_label') as string) || 'Training'

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const text = await file.text()
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return NextResponse.json({ error: 'CSV appears empty' }, { status: 400 })

  // Parse headers
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const fieldMap: Record<number, string> = {}
  rawHeaders.forEach((h, i) => {
    const field = mapHeader(h)
    if (field) fieldMap[i] = field
  })

  // Parse rows
  const rows = lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    cells.forEach((c, i) => { if (fieldMap[i]) row[fieldMap[i]] = c })
    return row
  }).filter(r => r.player_name)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No player rows found. Check the CSV has a "Name" or "Player Name" column.' }, { status: 400 })
  }

  // Load all students to match by name
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: students } = await adminClient.from('users').select('id, name').eq('role', 'student')
  const studentMap: Record<string, string> = {}
  students?.forEach(s => { studentMap[s.name.toLowerCase().trim()] = s.id })

  const inserted: string[] = []
  const unmatched: string[] = []

  for (const row of rows) {
    const nameKey = row.player_name?.toLowerCase().trim()
    const playerId = studentMap[nameKey]
    if (!playerId) { unmatched.push(row.player_name); continue }

    const sessionDate = parseDate(row.session_date) ?? new Date().toISOString().slice(0, 10)

    await adminClient.from('gps_sessions').insert({
      player_id:         playerId,
      session_date:      sessionDate,
      session_label:     row.session_label || sessionLabel,
      source:            'statsports',
      total_distance_m:  parseNum(row.total_distance_m),
      hsr_distance_m:    parseNum(row.hsr_distance_m),
      sprint_distance_m: parseNum(row.sprint_distance_m),
      max_speed_ms:      parseNum(row.max_speed_ms),
      max_speed_kmh:     parseNum(row.max_speed_kmh),
      sprint_count:      parseNum(row.sprint_count),
      accel_count:       parseNum(row.accel_count),
      decel_count:       parseNum(row.decel_count),
      player_load:       parseNum(row.player_load),
      hr_avg:            parseNum(row.hr_avg),
      hr_max:            parseNum(row.hr_max),
      duration_mins:     parseNum(row.duration_mins),
      imported_by:       user.id,
    })
    inserted.push(row.player_name)
  }

  return NextResponse.json({
    success: true,
    imported: inserted.length,
    unmatched: unmatched.length ? unmatched : undefined,
    message: `Imported ${inserted.length} player(s).${unmatched.length ? ` Could not match: ${unmatched.join(', ')} — check their names match exactly in the app.` : ''}`,
  })
}
