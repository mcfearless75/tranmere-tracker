import {
  buildNotificationMessage,
  notifyParentsOfCheckIn,
  type CheckInPhase,
  type CheckInStatus,
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

function makeMockAdmin(
  studentProfile: { display_name: string } | null,
  parents: { id: string }[]
) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: studentProfile })
  const parentSelect = {
    eq: jest.fn().mockReturnThis(),
    then: jest.fn(),
  }

  // Chain: .from('profiles').select('display_name').eq('id', ...).maybeSingle()
  // and:   .from('profiles').select('id').eq('linked_student_id', ...).eq('role', 'parent')
  let callCount = 0
  const from = jest.fn().mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      // First call: student profile lookup
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ maybeSingle }),
        }),
      }
    }
    // Second call: parent lookup
    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: parents }),
        }),
      }),
    }
  })

  return { from } as unknown as Parameters<typeof notifyParentsOfCheckIn>[0]
}

describe('notifyParentsOfCheckIn', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls sendPushNotificationToUser for each parent found', async () => {
    const admin = makeMockAdmin({ display_name: 'Alice Smith' }, [
      { id: 'parent-1' },
      { id: 'parent-2' },
    ])

    await notifyParentsOfCheckIn(admin, 'student-abc', 'am', 'checked_in')

    expect(mockSendPush).toHaveBeenCalledTimes(2)
    expect(mockSendPush).toHaveBeenCalledWith(admin, 'parent-1', expect.stringContaining('Alice Smith'), expect.any(String))
    expect(mockSendPush).toHaveBeenCalledWith(admin, 'parent-2', expect.stringContaining('Alice Smith'), expect.any(String))
  })

  it('does not call sendPushNotificationToUser when no parents are linked', async () => {
    const admin = makeMockAdmin({ display_name: 'Bob Jones' }, [])

    await notifyParentsOfCheckIn(admin, 'student-xyz', 'pm', 'checked_in')

    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('uses fallback name "Student" when profile not found', async () => {
    const admin = makeMockAdmin(null, [{ id: 'parent-3' }])

    await notifyParentsOfCheckIn(admin, 'student-missing', 'am', 'checked_in')

    expect(mockSendPush).toHaveBeenCalledWith(
      admin,
      'parent-3',
      expect.stringContaining('Student'),
      expect.stringContaining('Student')
    )
  })

  it('does not throw when sendPushNotificationToUser rejects', async () => {
    mockSendPush.mockRejectedValueOnce(new Error('Push service down'))
    const admin = makeMockAdmin({ display_name: 'Carol White' }, [{ id: 'parent-4' }])

    await expect(
      notifyParentsOfCheckIn(admin, 'student-err', 'pm', 'late')
    ).resolves.toBeUndefined()
  })

  it('does not throw when the DB query itself throws', async () => {
    const badAdmin = {
      from: jest.fn().mockImplementation(() => {
        throw new Error('DB connection lost')
      }),
    } as unknown as Parameters<typeof notifyParentsOfCheckIn>[0]

    await expect(
      notifyParentsOfCheckIn(badAdmin, 'student-dberr', 'am', 'checked_in')
    ).resolves.toBeUndefined()
  })
})
