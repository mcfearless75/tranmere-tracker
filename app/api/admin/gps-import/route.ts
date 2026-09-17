import { requireStaff } from '@/lib/auth/requireRole'
import { NextResponse } from 'next/server'
import {
  isCatapultCsv,
  normalizeCatapultCode,
  parseCatapultCsv,
} from '@/lib/gps/parseCatapultCsv'

export const dynamic = 'force-dynamic'

// ─── STATSports column aliases ───────────────────────────────────────────────
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
  zone1_m:           ['distance zone 1 (m)', 'zone 1 distance (m)', 'zone 1 (m)', 'velocity band 1 distance (m)'],
  zone2_m:           ['distance zone 2 (m)', 'zone 2 distance (m)', 'zone 2 (m)', 'velocity band 2 distance (m)'],
  zone3_m:           ['distance zone 3 (m)', 'zone 3 distance (m)', 'zone 3 (m)', 'velocity band 3 distance (m)'],
  zone4_m:           ['distance zone 4 (m)', 'zone 4 distance (m)', 'zone 4 (m)', 'velocity band 4 distance (m)'],
  zone5_m:           ['distance zone 5 (m)', 'zone 5 distance (m)', 'zone 5 (m)', 'velocity band 6 distance (m)'],
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
  const parts = v.trim().split(/[\/\-]/)
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
    if (parseInt(parts[2]) > 31) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  return null
}

function buildStudentMaps(students: { id: string; name: string; catapult_code: string | null }[]) {
  const byName: Record<string, string> = {}
  const byCode: Record<string, string> = {}
  for (const s of students) {
    byName[s.name.toLowerCase().trim()] = s.id
    if (s.catapult_code) {
      for (const key of normalizeCatapultCode(s.catapult_code)) {
        byCode[key] = s.id
      }
    }
  }
  return { byName, byCode }
}

function resolvePlayerId(
  rawName: string,
  maps: { byName: Record<string, string>; byCode: Record<string, string> }
): string | undefined {
  const nameKey = rawName.toLowerCase().trim()
  if (maps.byName[nameKey]) return maps.byName[nameKey]
  for (const key of normalizeCatapultCode(rawName)) {
    if (maps.byCode[key]) return maps.byCode[key]
  }
  return undefined
}

export async function POST(request: Request) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response
  const { user, admin: adminClient } = auth.ctx

  const form = await request.formData()
  const file = form.get('file') as File | null
  const sessionLabel = (form.get('session_label') as string) || 'Training'
  if (sessionLabel.length > 60) {
    return NextResponse.json({ error: 'Session label must be 60 characters or fewer' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const text = await file.text()
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return NextResponse.json({ error: 'CSV appears empty' }, { status: 400 })

  const { data: students } = await adminClient
    .from('users')
    .select('id, name, catapult_code')
    .eq('role', 'student')

  const maps = buildStudentMaps(students ?? [])

  const inserted: string[] = []
  const unmatched: string[] = []
  const skipped: string[] = []

  if (isCatapultCsv(lines[0])) {
    const parsed = parseCatapultCsv(text)
    if (parsed.length === 0) {
      return NextResponse.json({
        error: 'Catapult CSV parsed but no Full Match rows with distance were found.',
      }, { status: 400 })
    }

    for (const row of parsed) {
      const playerId = resolvePlayerId(row.playerName, maps)
      if (!playerId) {
        unmatched.push(row.playerName)
        continue
      }

      const label = row.sessionLabel || sessionLabel

      await adminClient
        .from('gps_sessions')
        .delete()
        .eq('player_id', playerId)
        .eq('session_date', row.sessionDate)
        .eq('session_label', label)
        .eq('source', 'catapult')

      const { error } = await adminClient.from('gps_sessions').insert({
        player_id:         playerId,
        session_date:      row.sessionDate,
        session_label:     label,
        source:            'catapult',
        total_distance_m:  row.total_distance_m,
        hsr_distance_m:    row.hsr_distance_m,
        sprint_distance_m: row.sprint_distance_m,
        max_speed_ms:      row.max_speed_ms,
        max_speed_kmh:     row.max_speed_kmh,
        accel_count:       row.accel_count,
        decel_count:       row.decel_count,
        player_load:       row.player_load,
        hr_max:            row.hr_max && row.hr_max > 0 ? row.hr_max : null,
        duration_mins:     row.duration_mins,
        zone1_m:           row.zone1_m,
        zone2_m:           row.zone2_m,
        zone3_m:           row.zone3_m,
        zone4_m:           row.zone4_m,
        zone5_m:           row.zone5_m,
        imported_by:       user.id,
      })

      if (error) {
        skipped.push(`${row.playerName}: ${error.message}`)
        continue
      }
      inserted.push(row.playerName)
    }

    return NextResponse.json({
      success: true,
      imported: inserted.length,
      unmatched: unmatched.length ? unmatched : undefined,
      skipped: skipped.length ? skipped : undefined,
      message: `Imported ${inserted.length} Catapult Full Match row(s).` +
        (unmatched.length ? ` Unmapped codes: ${[...new Set(unmatched)].join(', ')} — set Catapult code on the roster.` : '') +
        (skipped.length ? ` ${skipped.length} row(s) failed to save.` : ''),
    })
  }

  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const fieldMap: Record<number, string> = {}
  rawHeaders.forEach((h, i) => {
    const field = mapHeader(h)
    if (field) fieldMap[i] = field
  })

  const rows = lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    cells.forEach((c, i) => { if (fieldMap[i]) row[fieldMap[i]] = c })
    return row
  }).filter(r => r.player_name)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No player rows found. Check the CSV has a "Name" or "Player Name" column.' }, { status: 400 })
  }

  for (const row of rows) {
    const playerId = resolvePlayerId(row.player_name, maps)
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
      zone1_m:           parseNum(row.zone1_m),
      zone2_m:           parseNum(row.zone2_m),
      zone3_m:           parseNum(row.zone3_m),
      zone4_m:           parseNum(row.zone4_m),
      zone5_m:           parseNum(row.zone5_m),
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
