import { STUDENT_NAV_PRIMARY, STUDENT_NAV_ALL, resolveStudentNavAll, resolveStudentNavExtra } from '@/lib/nav/studentNav'

describe('studentNav', () => {
  // Regression: SideNav and BottomNav used to keep separate hand-written
  // lists and drifted apart — mobile gained Gym/Targets/Wellbeing/Calendar
  // without desktop, desktop had Nutrition/Moodle/Training/Matches/AI Report
  // without mobile. This is the one list both now read from.
  it('every primary tab is also present in the full nav list', () => {
    const allHrefs = STUDENT_NAV_ALL.map(item => item.href)
    for (const primary of STUDENT_NAV_PRIMARY) {
      expect(allHrefs).toContain(primary.href)
    }
  })

  it('includes every destination both navs previously listed, in one place', () => {
    const hrefs = STUDENT_NAV_ALL.map(item => item.href)
    // previously desktop-only
    expect(hrefs).toEqual(expect.arrayContaining(['/nutrition', '/training', '/matches', '/ai-report']))
    // previously mobile-only
    expect(hrefs).toEqual(expect.arrayContaining(['/gym', '/targets', '/wellbeing', '/calendar']))
  })

  it('resolveStudentNavAll omits Timetable/Coursework unless their flag is set', () => {
    const withoutFlags = resolveStudentNavAll({})
    expect(withoutFlags.some(item => item.href === '/timetable')).toBe(false)
    expect(withoutFlags.some(item => item.href === '/coursework')).toBe(false)

    const withFlags = resolveStudentNavAll({ showTimetable: true, showCoursework: true })
    expect(withFlags.some(item => item.href === '/timetable')).toBe(true)
    expect(withFlags.some(item => item.href === '/coursework')).toBe(true)
  })

  it('resolveStudentNavExtra excludes every primary-row href', () => {
    const extra = resolveStudentNavExtra({ showTimetable: true, showCoursework: true })
    const primaryHrefs = new Set(STUDENT_NAV_PRIMARY.map(item => item.href))
    for (const item of extra) {
      expect(primaryHrefs.has(item.href)).toBe(false)
    }
  })

  it('marks Moodle as an external link, everything else as internal', () => {
    const moodle = STUDENT_NAV_ALL.find(item => item.label === 'Moodle')
    expect(moodle?.external).toBe(true)
    const internalCount = STUDENT_NAV_ALL.filter(item => !item.external).length
    expect(internalCount).toBe(STUDENT_NAV_ALL.length - 1)
  })
})
