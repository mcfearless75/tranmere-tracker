import {
  RESOURCES,
  CATEGORY_LABELS,
  CATEGORY_COLOURS,
  filterByCategory,
  getFeatured,
  searchResources,
  type ResourceCategory,
  type LearningResource,
} from '@/lib/learningHub/learningHubUtils'

// ─── filterByCategory ─────────────────────────────────────────────────────────

describe('filterByCategory', () => {
  it('returns only resources matching the given category', () => {
    const results = filterByCategory(RESOURCES, 'maths')
    expect(results.every((r) => r.category === 'maths')).toBe(true)
  })

  it('returns an empty array when no resources match the category', () => {
    const empty: LearningResource[] = []
    expect(filterByCategory(empty, 'careers')).toEqual([])
  })

  it('returns results for every defined category', () => {
    const categories: ResourceCategory[] = [
      'study-skills',
      'maths',
      'english',
      'sport-science',
      'wellbeing',
      'careers',
    ]
    categories.forEach((cat) => {
      const results = filterByCategory(RESOURCES, cat)
      expect(results.length).toBeGreaterThan(0)
    })
  })

  it('does not mutate the original resources array', () => {
    const original = [...RESOURCES]
    filterByCategory(RESOURCES, 'english')
    expect(RESOURCES).toEqual(original)
  })
})

// ─── getFeatured ──────────────────────────────────────────────────────────────

describe('getFeatured', () => {
  it('returns only resources where featured is true', () => {
    const featured = getFeatured(RESOURCES)
    expect(featured.every((r) => r.featured)).toBe(true)
  })

  it('returns at least one featured resource per category', () => {
    const featured = getFeatured(RESOURCES)
    const categories = new Set(featured.map((r) => r.category))
    const allCategories: ResourceCategory[] = [
      'study-skills',
      'maths',
      'english',
      'sport-science',
      'wellbeing',
      'careers',
    ]
    allCategories.forEach((cat) => {
      expect(categories.has(cat)).toBe(true)
    })
  })

  it('returns an empty array when passed an empty list', () => {
    expect(getFeatured([])).toEqual([])
  })
})

// ─── searchResources ─────────────────────────────────────────────────────────

describe('searchResources', () => {
  it('returns all resources when query is an empty string', () => {
    expect(searchResources(RESOURCES, '')).toHaveLength(RESOURCES.length)
  })

  it('returns all resources when query is whitespace only', () => {
    expect(searchResources(RESOURCES, '   ')).toHaveLength(RESOURCES.length)
  })

  it('matches resources by title (case-insensitive)', () => {
    const results = searchResources(RESOURCES, 'khan academy')
    expect(results.some((r) => r.id === 'ma-01')).toBe(true)
  })

  it('matches resources by description keyword', () => {
    const results = searchResources(RESOURCES, 'spaced repetition')
    expect(results.length).toBeGreaterThan(0)
  })

  it('matches resources by tag', () => {
    const results = searchResources(RESOURCES, 'gcse')
    expect(results.length).toBeGreaterThan(0)
    results.forEach((r) => {
      const inTitle = r.title.toLowerCase().includes('gcse')
      const inDesc = r.description.toLowerCase().includes('gcse')
      const inTags = r.tags.some((t) => t.toLowerCase().includes('gcse'))
      expect(inTitle || inDesc || inTags).toBe(true)
    })
  })

  it('returns an empty array when no resources match the query', () => {
    const results = searchResources(RESOURCES, 'zzznomatch99999')
    expect(results).toHaveLength(0)
  })

  it('is case-insensitive for mixed-case input', () => {
    const lower = searchResources(RESOURCES, 'nhs')
    const upper = searchResources(RESOURCES, 'NHS')
    const mixed = searchResources(RESOURCES, 'Nhs')
    expect(lower).toEqual(upper)
    expect(lower).toEqual(mixed)
  })
})

// ─── static data integrity ───────────────────────────────────────────────────

describe('RESOURCES static data', () => {
  it('contains at least 18 resources', () => {
    expect(RESOURCES.length).toBeGreaterThanOrEqual(18)
  })

  it('every resource has a unique id', () => {
    const ids = RESOURCES.map((r) => r.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('every resource has a non-empty url', () => {
    RESOURCES.forEach((r) => {
      expect(r.url.trim().length).toBeGreaterThan(0)
    })
  })
})

// ─── CATEGORY_LABELS & CATEGORY_COLOURS ──────────────────────────────────────

describe('CATEGORY_LABELS and CATEGORY_COLOURS', () => {
  const categories: ResourceCategory[] = [
    'study-skills',
    'maths',
    'english',
    'sport-science',
    'wellbeing',
    'careers',
  ]

  it('has a label for every category', () => {
    categories.forEach((cat) => {
      expect(CATEGORY_LABELS[cat]).toBeTruthy()
    })
  })

  it('has a colour class for every category', () => {
    categories.forEach((cat) => {
      expect(CATEGORY_COLOURS[cat]).toBeTruthy()
    })
  })

  it('all colour classes are different from each other', () => {
    const colours = Object.values(CATEGORY_COLOURS)
    const unique = new Set(colours)
    expect(unique.size).toBe(colours.length)
  })
})
