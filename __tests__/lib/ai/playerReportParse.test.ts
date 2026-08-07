import { extractJsonObject, parsePlayerReport } from '@/lib/ai/player-report'

const REPORT_JSON = '{"headline":"On track","overall_rating":"on_track","strengths":[]}'

describe('extractJsonObject', () => {
  it('passes through bare JSON unchanged', () => {
    expect(extractJsonObject(REPORT_JSON)).toBe(REPORT_JSON)
  })

  it('strips ```json code fences', () => {
    const fenced = '```json\n' + REPORT_JSON + '\n```'
    expect(extractJsonObject(fenced)).toBe(REPORT_JSON)
  })

  it('strips bare ``` code fences', () => {
    const fenced = '```\n' + REPORT_JSON + '\n```'
    expect(extractJsonObject(fenced)).toBe(REPORT_JSON)
  })

  it('is case-insensitive on the fence language tag', () => {
    const fenced = '```JSON\n' + REPORT_JSON + '\n```'
    expect(extractJsonObject(fenced)).toBe(REPORT_JSON)
  })

  it('drops preamble text before the JSON object', () => {
    const withPreamble = 'Here is the development report you requested:\n\n' + REPORT_JSON
    expect(extractJsonObject(withPreamble)).toBe(REPORT_JSON)
  })

  it('drops trailing commentary after the JSON object', () => {
    const withTrailer = REPORT_JSON + '\n\nLet me know if you need anything else.'
    expect(extractJsonObject(withTrailer)).toBe(REPORT_JSON)
  })

  it('handles preamble + fences + trailer together', () => {
    const messy = 'Sure! Here it is:\n```json\n' + REPORT_JSON + '\n```\nHope this helps.'
    expect(extractJsonObject(messy)).toBe(REPORT_JSON)
  })

  it('tolerates surrounding whitespace', () => {
    expect(extractJsonObject('  \n' + REPORT_JSON + '\n  ')).toBe(REPORT_JSON)
  })

  it('throws when there is no JSON object at all', () => {
    expect(() => extractJsonObject('Sorry, I cannot generate a report.')).toThrow(
      'AI returned invalid JSON'
    )
  })

  it('throws on empty input', () => {
    expect(() => extractJsonObject('')).toThrow('AI returned invalid JSON')
  })

  it('throws when braces are in the wrong order', () => {
    expect(() => extractJsonObject('} nothing here {')).toThrow('AI returned invalid JSON')
  })
})

describe('parsePlayerReport', () => {
  it('parses a fenced report into an object', () => {
    const fenced = '```json\n' + REPORT_JSON + '\n```'
    const report = parsePlayerReport(fenced)
    expect(report.headline).toBe('On track')
    expect(report.overall_rating).toBe('on_track')
  })

  it('parses nested structures with braces inside strings', () => {
    const json = '{"headline":"Uses {braces} inside","strengths":[{"label":"a","detail":"b"}]}'
    const report = parsePlayerReport(json)
    expect(report.headline).toBe('Uses {braces} inside')
    expect(report.strengths).toHaveLength(1)
  })

  it('throws on truncated JSON (max_tokens cutoff mid-object)', () => {
    const truncated = REPORT_JSON.slice(0, 40)
    expect(() => parsePlayerReport(truncated)).toThrow('AI returned invalid JSON')
  })

  it('throws when the payload is a JSON array, not an object', () => {
    // No '{' at all → extraction fails before JSON.parse is reached
    expect(() => parsePlayerReport('[1,2,3]')).toThrow('AI returned invalid JSON')
  })

  it('throws on prose with no JSON', () => {
    expect(() => parsePlayerReport('The player is doing well overall.')).toThrow(
      'AI returned invalid JSON'
    )
  })
})
