import { detectDistressSignals } from '@/lib/safeguarding/distressDetection'

describe('detectDistressSignals', () => {
  it('returns an empty array for ordinary messages', () => {
    expect(detectDistressSignals('I feel a bit stressed about exams')).toEqual([])
  })

  it('returns an empty array for empty/whitespace input', () => {
    expect(detectDistressSignals('')).toEqual([])
    expect(detectDistressSignals('   ')).toEqual([])
  })

  it('does NOT match unrelated uses of the word "kill" (word-boundary check)', () => {
    expect(detectDistressSignals('I was killing it in training today!')).toEqual([])
  })

  it('matches self-harm/suicide phrasing', () => {
    expect(detectDistressSignals("I've been thinking about killing myself")).toEqual(['self_harm_or_suicide'])
    expect(detectDistressSignals('I want to end my life')).toEqual(['self_harm_or_suicide'])
    expect(detectDistressSignals("I don't want to be here anymore")).toEqual(['self_harm_or_suicide'])
  })

  it('is case-insensitive', () => {
    expect(detectDistressSignals('I WANT TO END MY LIFE')).toEqual(['self_harm_or_suicide'])
  })

  it('matches abuse disclosure phrasing', () => {
    expect(detectDistressSignals('he hits me at home')).toEqual(['abuse_disclosure'])
    expect(detectDistressSignals("someone is hurting me and I don't know what to do")).toEqual(['abuse_disclosure'])
  })

  it('matches hopelessness phrasing', () => {
    expect(detectDistressSignals("nothing matters anymore, I've given up on everything")).toEqual(['hopelessness'])
  })

  it('returns multiple categories when a message matches more than one', () => {
    const result = detectDistressSignals('I want to end my life, nothing matters anymore')
    expect(result).toEqual(['self_harm_or_suicide', 'hopelessness'])
  })
})
