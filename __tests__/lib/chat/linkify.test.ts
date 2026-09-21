import { tokenizeLinks } from '@/lib/chat/linkify'

describe('tokenizeLinks', () => {
  it('returns a single text token when there is no URL', () => {
    expect(tokenizeLinks('training at 6pm lads')).toEqual([
      { type: 'text', value: 'training at 6pm lads' },
    ])
  })

  it('linkifies an https URL', () => {
    expect(tokenizeLinks('https://example.com/sheet')).toEqual([
      { type: 'link', value: 'https://example.com/sheet', href: 'https://example.com/sheet' },
    ])
  })

  it('keeps surrounding text as separate tokens', () => {
    expect(tokenizeLinks('tracker here https://example.com/x thanks')).toEqual([
      { type: 'text', value: 'tracker here ' },
      { type: 'link', value: 'https://example.com/x', href: 'https://example.com/x' },
      { type: 'text', value: ' thanks' },
    ])
  })

  it('upgrades a bare www. link to https for the href but shows it as typed', () => {
    expect(tokenizeLinks('www.example.com')).toEqual([
      { type: 'link', value: 'www.example.com', href: 'https://www.example.com' },
    ])
  })

  it('preserves the full query string of a OneDrive/SharePoint style link', () => {
    const url =
      'https://tranmere-my.sharepoint.com/:x:/g/personal/coach/EaBcD12?e=4%3Axyz&at=9&download=1'
    expect(tokenizeLinks(`Tracker: ${url}`)).toEqual([
      { type: 'text', value: 'Tracker: ' },
      { type: 'link', value: url, href: url },
    ])
  })

  it('drops trailing sentence punctuation from the link', () => {
    expect(tokenizeLinks('see https://example.com/a.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', value: '.' },
    ])
  })

  it('keeps balanced parentheses but drops an unbalanced closing one', () => {
    expect(tokenizeLinks('(see https://example.com/a_(b)c)')).toEqual([
      { type: 'text', value: '(see ' },
      { type: 'link', value: 'https://example.com/a_(b)c', href: 'https://example.com/a_(b)c' },
      { type: 'text', value: ')' },
    ])
  })

  it('handles several links in one message', () => {
    expect(tokenizeLinks('a https://one.com b http://two.com c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'link', value: 'https://one.com', href: 'https://one.com' },
      { type: 'text', value: ' b ' },
      { type: 'link', value: 'http://two.com', href: 'http://two.com' },
      { type: 'text', value: ' c' },
    ])
  })

  it('does not linkify a javascript: payload', () => {
    // eslint-disable-next-line no-script-url
    const input = 'javascript:alert(1)'
    expect(tokenizeLinks(input)).toEqual([{ type: 'text', value: input }])
  })

  it('does not treat an email address as a link', () => {
    expect(tokenizeLinks('mail me at coach@example.com')).toEqual([
      { type: 'text', value: 'mail me at coach@example.com' },
    ])
  })

  it('returns an empty array for an empty body', () => {
    expect(tokenizeLinks('')).toEqual([])
  })
})
