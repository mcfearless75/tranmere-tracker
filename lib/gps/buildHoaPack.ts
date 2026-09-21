export type HoaPlayer = {
  name: string
  distanceM: number
  sprintM: number
  maxKmh: number
  load: number
}

function lastName(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] || name
}

export async function downloadHoaPack(opts: {
  date: string
  opposition: string
  players: HoaPlayer[]
}) {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
  pres.layout = 'WIDE'
  pres.title = `TR Prem vs ${opts.opposition} — Match GPS`

  const NAVY = '0B1220'
  const CARD = '141C2B'
  const LINE = '243044'
  const RED = 'C8102E'
  const GOLD = 'E8B923'
  const WHITE = 'F4F7FB'
  const MUTED = '8B97A8'
  const CYAN = '4EC8E0'
  const GREEN = '3DDC97'

  const rows = [...opts.players].sort((a, b) => b.distanceM - a.distanceM)
  const live = rows.filter((p) => p.distanceM > 0)
  const missing = rows.filter((p) => p.distanceM <= 0)
  const labels = live.map((p) => lastName(p.name))
  const dist = live.map((p) => Math.round(p.distanceM))
  const sprint = live.map((p) => Math.round(p.sprintM))
  const kmh = live.map((p) => +p.maxKmh.toFixed(1))

  const total = live.reduce((a, p) => a + p.distanceM, 0)
  const avg = live.length ? total / live.length : 0
  const topSpeed = live.reduce((a, p) => (p.maxKmh > a.maxKmh ? p : a), live[0])
  const topSprint = live.reduce((a, p) => (p.sprintM > a.sprintM ? p : a), live[0])
  const topDist = live[0]

  function footer(slide: any, page: string) {
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 7.22, w: 13.333, h: 0.28, fill: { color: '070B12' } })
    slide.addText('TRANMERE ROVERS ACADEMY  ·  CONFIDENTIAL  ·  HEAD OF ACADEMY', {
      x: 0.4, y: 7.22, w: 9, h: 0.28, fontFace: 'Arial', fontSize: 10, color: MUTED, valign: 'middle',
    })
    slide.addText(page, {
      x: 11.6, y: 7.22, w: 1.3, h: 0.28, fontFace: 'Arial', fontSize: 10, color: MUTED, align: 'right', valign: 'middle',
    })
  }

  function paint(slide: any) {
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: NAVY } })
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.14, h: 7.5, fill: { color: RED } })
  }

  function kpi(slide: any, x: number, y: number, value: string, label: string, accent: string) {
    slide.addShape(pres.ShapeType.roundRect, { x, y, w: 2.4, h: 1.18, fill: { color: CARD }, rectRadius: 0.08 })
    slide.addShape(pres.ShapeType.rect, { x, y, w: 0.08, h: 1.18, fill: { color: accent } })
    slide.addText(value, { x: x + 0.2, y: y + 0.12, w: 2.1, h: 0.62, fontFace: 'Arial', fontSize: 22, bold: true, color: WHITE })
    slide.addText(label, { x: x + 0.2, y: y + 0.7, w: 2.1, h: 0.34, fontFace: 'Arial', fontSize: 10, color: MUTED })
  }

  {
    const s = pres.addSlide()
    paint(s)
    s.addText('MATCH GPS', { x: 0.5, y: 0.22, w: 4, h: 0.26, fontFace: 'Arial', fontSize: 11, color: GOLD, bold: true })
    s.addText(`TR Prem  vs  ${opts.opposition}`, {
      x: 0.5, y: 0.46, w: 12, h: 0.42, fontFace: 'Arial', fontSize: 26, bold: true, color: WHITE,
    })
    s.addText(`${opts.date}   ·   Full match files   ·   ${live.length} of ${rows.length} units recorded`, {
      x: 0.5, y: 0.92, w: 12, h: 0.24, fontFace: 'Arial', fontSize: 12, color: MUTED,
    })
    kpi(s, 0.5, 1.35, live.length ? `${(total / 1000).toFixed(1)} km` : '—', 'Squad distance', RED)
    kpi(s, 3.05, 1.35, live.length ? `${Math.round(avg).toLocaleString()} m` : '—', 'Average / player', CYAN)
    kpi(s, 5.6, 1.35, topSpeed ? `${topSpeed.maxKmh.toFixed(1)} km/h` : '—', topSpeed ? `Peak speed  ·  ${lastName(topSpeed.name)}` : 'Peak speed', GOLD)
    kpi(s, 8.15, 1.35, topSprint ? `${Math.round(topSprint.sprintM).toLocaleString()} m` : '—', topSprint ? `Peak sprint  ·  ${lastName(topSprint.name)}` : 'Peak sprint', GREEN)
    kpi(s, 10.7, 1.35, `${live.length} / ${rows.length}`, 'Units with a file', MUTED)

    if (live.length) {
      s.addChart(pres.ChartType.bar, [{ name: 'Distance m', labels, values: dist }], {
        x: 0.35, y: 2.7, w: 8.3, h: 4.3, barDir: 'bar', showLegend: false, chartColors: [RED],
        catAxisLabelColor: MUTED, catAxisLabelFontSize: 9, valAxisLabelColor: MUTED, valAxisLabelFontSize: 9,
        valAxisMinVal: 0, valGridLine: { color: LINE }, catGridLine: { style: 'none' },
        chartArea: { fill: { type: 'none' } }, plotArea: { fill: { type: 'none' } },
      })
    }
    s.addShape(pres.ShapeType.roundRect, { x: 8.9, y: 2.7, w: 4.0, h: 4.3, fill: { color: CARD }, rectRadius: 0.08 })
    s.addText('SIGNALS', { x: 9.1, y: 2.84, w: 3.6, h: 0.24, fontFace: 'Arial', fontSize: 11, color: GOLD, bold: true })
    const signals = [
      topDist ? ['Highest output', `${lastName(topDist.name)}  ${Math.round(topDist.distanceM).toLocaleString()} m`] : null,
      topSprint ? ['Highest intensity', `${lastName(topSprint.name)}  ${Math.round(topSprint.sprintM).toLocaleString()} m sprint`] : null,
      topSpeed ? ['Fastest', `${lastName(topSpeed.name)}  ${topSpeed.maxKmh.toFixed(1)} km/h`] : null,
      missing[0] ? ['No file', lastName(missing[0].name)] : ['Files', `${live.length} recorded`],
    ].filter(Boolean) as string[][]
    signals.forEach((row, i) => {
      const y = 3.2 + i * 0.85
      s.addText(row[0], { x: 9.1, y, w: 3.6, h: 0.22, fontFace: 'Arial', fontSize: 10, color: MUTED })
      s.addText(row[1], { x: 9.1, y: y + 0.22, w: 3.6, h: 0.32, fontFace: 'Arial', fontSize: 14, bold: true, color: WHITE })
    })
    footer(s, '01')
  }

  if (live.length) {
    const s = pres.addSlide()
    paint(s)
    s.addText('SPEED  ·  SPRINT VOLUME', { x: 0.5, y: 0.22, w: 12, h: 0.34, fontFace: 'Arial', fontSize: 22, bold: true, color: WHITE })
    s.addChart(pres.ChartType.bar, [{ name: 'Max km/h', labels, values: kmh }], {
      x: 0.3, y: 0.9, w: 6.4, h: 6.0, barDir: 'bar', chartColors: [GOLD], showLegend: false,
      catAxisLabelColor: MUTED, catAxisLabelFontSize: 9, valAxisLabelColor: MUTED, valAxisMinVal: 0,
      valGridLine: { color: LINE }, catGridLine: { style: 'none' },
      chartArea: { fill: { type: 'none' } }, plotArea: { fill: { type: 'none' } },
    })
    s.addChart(pres.ChartType.bar, [{ name: 'Sprint m', labels, values: sprint }], {
      x: 6.8, y: 0.9, w: 6.2, h: 6.0, barDir: 'bar', chartColors: [CYAN], showLegend: false,
      catAxisLabelColor: MUTED, catAxisLabelFontSize: 9, valAxisLabelColor: MUTED, valAxisMinVal: 0,
      valGridLine: { color: LINE }, catGridLine: { style: 'none' },
      chartArea: { fill: { type: 'none' } }, plotArea: { fill: { type: 'none' } },
    })
    footer(s, '02')
  }

  {
    const s = pres.addSlide()
    paint(s)
    s.addText('RANKED SQUAD', { x: 0.5, y: 0.2, w: 12, h: 0.32, fontFace: 'Arial', fontSize: 22, bold: true, color: WHITE })
    const header = ['#', 'PLAYER', 'DISTANCE', 'SPRINT', 'MAX km/h', 'LOAD'].map((t) => ({
      text: t,
      options: { fill: { color: RED }, color: WHITE, bold: true, align: t === 'PLAYER' || t === '#' ? 'left' : 'right' },
    }))
    const table = [header]
    live.forEach((p, i) => {
      const bg = i % 2 === 0 ? CARD : '101826'
      table.push([
        { text: String(i + 1), options: { fill: { color: bg }, color: GOLD, bold: true } },
        { text: p.name, options: { fill: { color: bg }, color: WHITE } },
        { text: Math.round(p.distanceM).toLocaleString(), options: { fill: { color: bg }, color: WHITE, align: 'right' } },
        { text: Math.round(p.sprintM).toLocaleString(), options: { fill: { color: bg }, color: CYAN, align: 'right' } },
        { text: p.maxKmh.toFixed(1), options: { fill: { color: bg }, color: GOLD, align: 'right' } },
        { text: String(Math.round(p.load)), options: { fill: { color: bg }, color: WHITE, align: 'right' } },
      ] as any)
    })
    s.addTable(table as any, {
      x: 0.4, y: 0.65, w: 12.5, h: 6.3,
      colW: [0.7, 4.2, 2.1, 2.0, 1.9, 1.6],
      border: [{ pt: 0 }, { pt: 0 }, { pt: 0 }, { pt: 0 }],
      fontFace: 'Arial', fontSize: 12, valign: 'middle',
    })
    footer(s, '03')
  }

  const safeOpp = opts.opposition.replace(/[^a-z0-9]+/gi, '-') || 'match'
  await pres.writeFile({ fileName: `TR-Prem-vs-${safeOpp}-HOA-GPS.pptx` })
}
