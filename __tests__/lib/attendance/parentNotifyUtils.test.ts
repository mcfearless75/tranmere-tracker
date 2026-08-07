import {
  buildNotificationMessage,
  notifyParentsOfCheckIn,
} from '@/lib/attendance/parentNotifyUtils'

// --- Pure formatting tests ---

describe('buildNotificationMessage', () => {
  it('returns a check-in title for checked_in status', () => {
    const { title } = buildNotificationMessage('Alice Smith', 'am', 'checked_in', '08:45')
    expect(title).toBe('✅ Check-in — Alice Smith')
  })

  it('returns a late title for late status', () => {
    const { title } = buildNotificationMessage('Bob Jones', 'pm', 'late', '14:10')
    expect(title).toBe('⚠️ Late Check-in — Bob Jones')
  })

  it('returns AM session body for phase am', () => {
    const { body } = buildNotificationMessage('Alice Smith', 'am', 'checked_in', '08:45')
    expect(body).toBe('Alice Smith checked in for AM session at 08:45')
  })

  it('returns PM session body for phase pm', () => {
    const { body } = buildNotificationMessage('Carol White', 'pm', 'checked_in', '13:05')
    expect(body).toBe('Carol White checked in for PM session at 13:05')
  })

  it('returns "checked in for lunch" body for phase lunch', () => {
    const { body } = buildNotificationMessage('Alice Smith', 'lunch', 'checked_in', '12:15')
    expect(body).toBe('Alice Smith checked in for lunch at 12:15')
  })

  it('keeps the late title for a late lunch check-in', () => {
    const { title, body } = buildNotificationMessage('Bob Jones', 'lunch', 'late', '13:40')
    expect(title).toBe('⚠️ Late Check-in — Bob Jones')
    expect(body).toContain('checked in for lunch at 13:40')
  })

  it('uses checked_in (not late) title for absent status', () => {
    // absent is not late — title should use the default check-in prefix
    const { title } = buildNotificationMessage('Dave Brown', 'am', 'absent', '09:00')
    expect(title).toBe('✅ Check-in — Dave Brown')
  })

  it('interpolates the student name correctly in both title and body', () => {
    const { title, body } = buildNotificationMessage('Eve Clark', 'pm', 'late', '14:55')
    expect(title).toContain('Eve Clark')
    expect(body).toContain('Eve Clark')
  })
})

// --- Integration-style tests with mocked DB and push ---

jest.mock('@/lib/webpush', () => ({
  sendPushNotificationToUser: jest.fn().mockResolvedValue(undefined),
}))

import { sendPushNotificationToUser } from '@/lib/webpush'

const mockSendPush = sendPushNotificationToUser as jest.MockedFunction<
  typeof sendPushNotificationToUser
>

/**
 * Mocks the real schema:
 *   .from('users').select('name').eq('id', ...).maybeSingle()
 *   .from('parent_student_links').select('parent_id').eq('student_id', ...)
 */
function makeMockAdmin(
  student: { name: string } | null,
  links: { parent_id: string }[]
) {
  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: student }),
          }),
        }),
      }
    }
    if (table === 'parent_student_links') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: links }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { from } as unknown as Parameters<typeof notifyParentsOfCheckIn>[0]
}

describe('notifyParentsOfCheckIn', () => {
  beforeEach(() => jest.clearAllMocks())

  it('queries users and parent_student_links (not the non-existent profiles table)', async () => {
    const admin = makeMockAdmin({ name: 'Alice Smith' }, [{ parent_id: 'parent-1' }])

    await notifyParentsOfCheckIn(admin, 'student-abc', 'am', 'checked_in')

    const fromMock = (admin as unknown as { from: jest.Mock }).from
    expect(fromMock).toHaveBeenCalledWith('users')
    expect(fromMock).toHaveBeenCalledWith('parent_student_links')
    expect(fromMock).not.toHaveBeenCalledWith('profiles')
  })

  it('calls sendPushNotificationToUser for each linked parent', async () => {
    const admin = makeMockAdmin({ name: 'Alice Smith' }, [
      { parent_id: 'parent-1' },
      { parent_id: 'parent-2' },
    ])

    await notifyParentsOfCheckIn(admin, 'student-abc', 'am', 'checked_in')

    expect(mockSendPush).toHaveBeenCalledTimes(2)
    expect(mockSendPush).toHaveBeenCalledWith(admin, 'parent-1', expect.stringContaining('Alice Smith'), expect.any(String))
    expect(mockSendPush).toHaveBeenCalledWith(admin, 'parent-2', expect.stringContaining('Alice Smith'), expect.any(String))
  })

  it('sends the lunch copy for a lunch check-in', async () => {
    const admin = makeMockAdmin({ name: 'Alice Smith' }, [{ parent_id: 'parent-1' }])

    await notifyParentsOfCheckIn(admin, 'student-abc', 'lunch', 'checked_in')

    expect(mockSendPush).toHaveBeenCalledWith(
      admin,
      'parent-1',
      expect.any(String),
      expect.stringContaining('checked in for lunch')
    )
  })

  it('does not call sendPushNotificationToUser when no parents are linked', async () => {
    const admin = makeMockAdmin({ name: 'Bob Jones' }, [])

    await notifyParentsOfCheckIn(admin, 'student-xyz', 'pm', 'checked_in')

    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('uses fallback name "Student" when the users row is missing', async () => {
    const admin = makeMockAdmin(null, [{ parent_id: 'parent-3' }])

    await notifyParentsOfCheckIn(admin, 'student-missing', 'am', 'checked_in')

    expect(mockSendPush).toHaveBeenCalledWith(
      admin,
      'parent-3',
      expect.stringContaining('Student'),
      expect.stringContaining('Student')
    )
  })

  it('does not throw when sendPushNotificationToUser rejects', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockSendPush.mockRejectedValueOnce(new Error('Push service down'))
    const admin = makeMockAdmin({ name: 'Carol White' }, [{ parent_id: 'parent-4' }])

    await expect(
      notifyParentsOfCheckIn(admin, 'student-err', 'pm', 'late')
    ).resolves.toBeUndefined()
    consoleSpy.mockRestore()
  })

  it('does not throw when the DB query itself throws — but logs the failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const badAdmin = {
      from: jest.fn().mockImplementation(() => {
        throw new Error('DB connection lost')
      }),
    } as unknown as Parameters<typeof notifyParentsOfCheckIn>[0]

    await expect(
      notifyParentsOfCheckIn(badAdmin, 'student-dberr', 'am', 'checked_in')
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
