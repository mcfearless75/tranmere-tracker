import {
  canonicalRedirectTarget,
  readCanonicalConfig,
  type CanonicalConfig,
} from '@/lib/middleware/canonicalHost'

const base: CanonicalConfig = {
  canonicalHost: 'app.thesolarcampus.com',
  legacyHosts: ['tranmeretracker.vercel.app'],
  paths: ['/attendance'],
  disabled: false,
}

const TAG = '?tag=9af4a580bbe347c5aacc551ba56e75c5'

describe('canonicalRedirectTarget (phase 1: /attendance only)', () => {
  it('redirects a sticker tap on the legacy host to the canonical host, keeping the tag', () => {
    expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/attendance', search: TAG }, base))
      .toBe(`https://app.thesolarcampus.com/attendance${TAG}&moved=1`)
  })

  it('keeps the existing query intact (including any tracking params) and appends moved=1', () => {
    const search = `${TAG}&utm_campaign=Proton+Custom+Tile&utm_medium=qr_code&utm_source=QRCodeGeneratorHub`
    const target = canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/attendance', search }, base)
    expect(target).toContain('tag=9af4a580bbe347c5aacc551ba56e75c5')
    expect(target).toContain('moved=1')
    expect(target?.startsWith('https://app.thesolarcampus.com/attendance?')).toBe(true)
  })

  it('does not redirect other pages on the legacy host in phase 1', () => {
    expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/dashboard', search: '' }, base)).toBeNull()
    expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/attendances', search: '' }, base)).toBeNull()
  })

  it('redirects sub-paths of a listed prefix', () => {
    expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/attendance/history', search: '' }, base))
      .toBe('https://app.thesolarcampus.com/attendance/history?moved=1')
  })

  it('never redirects requests already on the canonical host', () => {
    expect(canonicalRedirectTarget({ host: 'app.thesolarcampus.com', pathname: '/attendance', search: TAG }, base)).toBeNull()
  })

  it('never redirects preview deployment hosts (exact legacy match only)', () => {
    expect(canonicalRedirectTarget({ host: 'tranmeretracker-abc123-paul.vercel.app', pathname: '/attendance', search: TAG }, base)).toBeNull()
    expect(canonicalRedirectTarget({ host: 'localhost:3000', pathname: '/attendance', search: TAG }, base)).toBeNull()
  })

  it('ignores a port and letter case on the legacy host', () => {
    expect(canonicalRedirectTarget({ host: 'Tranmeretracker.Vercel.App:443', pathname: '/attendance', search: '' }, base))
      .toBe('https://app.thesolarcampus.com/attendance?moved=1')
  })

  it.each(['/api/attendance/check-in', '/api/cron/missed-checkin-sweep', '/.well-known/apple-app-site-association', '/.well-known/assetlinks.json', '/_next/static/x.js'])(
    'never redirects %s even when every path is in scope',
    pathname => {
      expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname, search: '' }, { ...base, paths: 'all' })).toBeNull()
    },
  )

  it('handles a missing host header', () => {
    expect(canonicalRedirectTarget({ host: null, pathname: '/attendance', search: '' }, base)).toBeNull()
    expect(canonicalRedirectTarget({ host: '', pathname: '/attendance', search: '' }, base)).toBeNull()
  })
})

describe('canonicalRedirectTarget (phase 2: all paths)', () => {
  const all = { ...base, paths: 'all' as const }
  it('redirects every page including the root', () => {
    expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/dashboard', search: '' }, all))
      .toBe('https://app.thesolarcampus.com/dashboard?moved=1')
    expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/', search: '' }, all))
      .toBe('https://app.thesolarcampus.com/?moved=1')
  })
})

describe('kill switch', () => {
  it('returns null for everything when disabled', () => {
    expect(canonicalRedirectTarget({ host: 'tranmeretracker.vercel.app', pathname: '/attendance', search: TAG }, { ...base, disabled: true })).toBeNull()
  })
})

describe('readCanonicalConfig', () => {
  it('uses the documented defaults when nothing is set', () => {
    expect(readCanonicalConfig({})).toEqual({
      canonicalHost: 'app.thesolarcampus.com',
      legacyHosts: ['tranmeretracker.vercel.app'],
      paths: ['/attendance'],
      disabled: false,
    })
  })

  it('reads a comma list of hosts and paths, and the "all" keyword', () => {
    const cfg = readCanonicalConfig({
      CANONICAL_HOST: 'App.TheSolarCampus.com',
      LEGACY_HOSTS: 'tranmeretracker.vercel.app, old.example.com',
      CANONICAL_REDIRECT_PATHS: 'ALL',
    })
    expect(cfg.canonicalHost).toBe('app.thesolarcampus.com')
    expect(cfg.legacyHosts).toEqual(['tranmeretracker.vercel.app', 'old.example.com'])
    expect(cfg.paths).toBe('all')
  })

  it('reads explicit path prefixes', () => {
    expect(readCanonicalConfig({ CANONICAL_REDIRECT_PATHS: '/attendance, /dashboard' }).paths).toEqual(['/attendance', '/dashboard'])
  })

  it.each(['1', 'true', 'TRUE'])('DISABLE_CANONICAL_REDIRECT=%s disables it', v => {
    expect(readCanonicalConfig({ DISABLE_CANONICAL_REDIRECT: v }).disabled).toBe(true)
  })

  it('treats an empty or "0" kill switch as enabled', () => {
    expect(readCanonicalConfig({ DISABLE_CANONICAL_REDIRECT: '' }).disabled).toBe(false)
    expect(readCanonicalConfig({ DISABLE_CANONICAL_REDIRECT: '0' }).disabled).toBe(false)
  })
})
