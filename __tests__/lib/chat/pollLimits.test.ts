/** @jest-environment node */
import {
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
  POLL_MIN_OPTIONS,
  POLL_MAX_OPTIONS,
  validatePollInput,
} from '@/lib/chat/types'

describe('validatePollInput', () => {
  it('accepts a normal poll', () => {
    expect(validatePollInput('Who is coming Saturday?', ['Yes', 'No'])).toBeNull()
  })

  it('rejects an empty question', () => {
    expect(validatePollInput('   ', ['Yes', 'No'])).toBe('Add a question')
  })

  it('rejects an over-length question', () => {
    expect(validatePollInput('q'.repeat(POLL_QUESTION_MAX + 1), ['Yes', 'No']))
      .toBe(`Question must be ${POLL_QUESTION_MAX} characters or fewer`)
  })

  it('rejects fewer than the minimum options', () => {
    expect(validatePollInput('Q', ['Only one']))
      .toBe(`Add at least ${POLL_MIN_OPTIONS} options`)
  })

  it('ignores blank option rows when counting', () => {
    expect(validatePollInput('Q', ['Yes', '  ', '']))
      .toBe(`Add at least ${POLL_MIN_OPTIONS} options`)
  })

  it('rejects more than the maximum options', () => {
    const many = Array.from({ length: POLL_MAX_OPTIONS + 1 }, (_, i) => `Option ${i}`)
    expect(validatePollInput('Q', many)).toBe(`Use ${POLL_MAX_OPTIONS} options or fewer`)
  })

  it('rejects an over-length option label', () => {
    expect(validatePollInput('Q', ['Yes', 'x'.repeat(POLL_OPTION_MAX + 1)]))
      .toBe(`Each option must be ${POLL_OPTION_MAX} characters or fewer`)
  })

  it('rejects duplicate options', () => {
    expect(validatePollInput('Q', ['Yes', 'yes'])).toBe('Options must be different')
  })
})
