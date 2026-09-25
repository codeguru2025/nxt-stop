import { describe, it, expect, vi, beforeEach } from 'vitest'

const settings = new Map<string, string>()
vi.mock('../db', () => ({
  prisma: {
    setting: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null,
      upsert: async ({ where, update }: { where: { key: string }; update: { value: string } }) => {
        settings.set(where.key, update.value)
      },
    },
  },
}))
const notify = vi.fn()
vi.mock('../push', () => ({ notifyAdmins: (...a: unknown[]) => notify(...a) }))

import { checkSmsCreditAlert, maskPhone, SMS_LOW_CREDITS } from '../smsCredits'

beforeEach(() => { settings.clear(); notify.mockReset() })

describe('checkSmsCreditAlert', () => {
  it('alerts once when credits get low, once when they run out, and again after a top-up', async () => {
    await checkSmsCreditAlert(500)
    expect(notify).not.toHaveBeenCalled()

    await checkSmsCreditAlert(SMS_LOW_CREDITS)
    await checkSmsCreditAlert(SMS_LOW_CREDITS - 1) // busy day: no repeat alert per order
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0].title).toBe('SMS credits running low')

    await checkSmsCreditAlert(0)
    await checkSmsCreditAlert(0)
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls[1][0].title).toBe('SMS credits used up')

    await checkSmsCreditAlert(5000) // top-up
    await checkSmsCreditAlert(SMS_LOW_CREDITS)
    expect(notify).toHaveBeenCalledTimes(3)
  })
})

describe('maskPhone', () => {
  it('keeps the country and network code and the last three digits', () => {
    expect(maskPhone('+263771234567')).toBe('+26377***567')
  })
})
