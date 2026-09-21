export type CatapultParsedRow = {
  playerName: string
  sessionDate: string
  sessionLabel: string
  splitName: string
  total_distance_m: number | null
  hsr_distance_m: number | null
  sprint_distance_m: number | null
  max_speed_ms: number | null
  max_speed_kmh: number | null
  accel_count: number | null
  decel_count: number | null
  player_load: number | null
  hr_max: number | null
  duration_mins: number | null
  zone1_m: number | null
  zone2_m: number | null
  zone3_m: number | null
  zone4_m: number | null
  zone5_m: number | null
}

const HEADER_ALIASES: Record<string, string[]> = {
  player_name: ['player name'],
  session_date: ['date'],
  session_title: ['session title'],
  split_name: ['split name'],
  duration: ['duration'],
  distance: ['distance (metres)', 'distance (meters)'],
  sprint_distance: ['sprint distance (m)'],
  player_load: ['player load'],
  top_speed_ms: ['top speed (m/s)'],
  hr_max: ['hr max (bpm)'],
  z1: ['distance in speed zone 1  (metres)', 'distance in speed zone 1 (metres)'],
  z2: ['distance in speed zone 2  (metres)', 'distance in speed zone 2 (metres)'],
  z3: ['distance in speed zone 3  (metres)', 'distance in speed zone 3 (metres)'],
  z4: ['distance in speed zone 4  (metres)', 'distance in speed zone 4 (metres)'],
  z5: ['distance in speed zone 5  (metres)', 'distance in speed zone 5 (metres)'],
  acc_2: ['accelerations zone count: 2 - 3 m/s/s'],
  acc_3: ['accelerations zone count: 3 - 4 m/s/s'],
  acc_4: ['accelerations zone count: > 4 m/s/s'],
  dec_2: ['deceleration zone count: 2 - 3 m/s/s'],
  dec_3: ['deceleration zone count: 3 - 4 m/s/s'],
  dec_4: ['deceleration zone count: > 4 m/s/s'],
}

export function isCatapultCsv(headerLine: string): boolean {
  const lower = headerLine.toLowerCase()
  return lower.includes('sprint distance (m)') && lower.includes('split name') && lower.includes('player name')
}

export function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000) return null
  const utc = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000
  return new Date(utc).toISOString().slice(0, 10)
}

export function normalizeCatapultCode(raw: string): string[] {
  const trimmed = raw.trim()
  const keys = new Set<string>()
  if (!trimmed) return []
  keys.add(trimmed.toLowerCase())
  const pMatch = trimmed.match(/p\s*(\d+)/i)
  if (pMatch) {
    keys.add(`p${pMatch[1]}`)
    keys.add(`tranmere p${pMatch[1]}`)
  }
  return [...keys]
}

function parseNum(v: string | undefined): number | null {
  if (!v) return null
  const n = parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function mapHeaders(rawHeaders: string[]): Record<number, string> {
  const fieldMap: Record<number, string> = {}
  rawHeaders.forEach((h, i) => {
    const lower = h.trim().toLowerCase().replace(/"/g, '')
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(lower)) {
        fieldMap[i] = field
        break
      }
    }
  })
  return fieldMap
}

export function parseCatapultCsv(text: string): CatapultParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const rawHeaders = splitCsvLine(lines[0])
  const fieldMap = mapHeaders(rawHeaders)

  const rows: CatapultParsedRow[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const raw: Record<string, string> = {}
    cells.forEach((c, i) => {
      if (fieldMap[i]) raw[fieldMap[i]] = c.replace(/^"|"$/g, '')
    })
    if (!raw.player_name) continue

    const splitName = (raw.split_name || '').trim()
    const distance = parseNum(raw.distance)
    if ((distance ?? 0) <= 0 && (parseNum(raw.duration) ?? 0) <= 0) continue

    const dateSerial = parseNum(raw.session_date)
    const sessionDate = dateSerial ? excelSerialToISO(dateSerial) : null
    if (!sessionDate) continue

    const z4 = parseNum(raw.z4) ?? 0
    const z5 = parseNum(raw.z5) ?? 0
    const acc = (parseNum(raw.acc_2) ?? 0) + (parseNum(raw.acc_3) ?? 0) + (parseNum(raw.acc_4) ?? 0)
    const dec = (parseNum(raw.dec_2) ?? 0) + (parseNum(raw.dec_3) ?? 0) + (parseNum(raw.dec_4) ?? 0)
    const topMs = parseNum(raw.top_speed_ms)
    const durationSecs = parseNum(raw.duration)

    rows.push({
      playerName: raw.player_name.trim(),
      sessionDate,
      sessionLabel: (raw.session_title || '').trim(),
      splitName,
      total_distance_m: distance,
      hsr_distance_m: z4 + z5 || null,
      sprint_distance_m: parseNum(raw.sprint_distance),
      max_speed_ms: topMs,
      max_speed_kmh: topMs != null ? Math.round(topMs * 3.6 * 10) / 10 : null,
      accel_count: acc || null,
      decel_count: dec || null,
      player_load: parseNum(raw.player_load),
      hr_max: parseNum(raw.hr_max),
      duration_mins: durationSecs != null ? Math.round((durationSecs / 60) * 10) / 10 : null,
      zone1_m: parseNum(raw.z1),
      zone2_m: parseNum(raw.z2),
      zone3_m: parseNum(raw.z3),
      zone4_m: parseNum(raw.z4),
      zone5_m: parseNum(raw.z5),
    })
  }

  const hasFullMatch = rows.some((r) => r.splitName.toLowerCase() === 'full match')
  return hasFullMatch
    ? rows.filter((r) => r.splitName.toLowerCase() === 'full match')
    : rows.filter((r) => r.splitName.toLowerCase() === 'all' || r.splitName === '')
}
