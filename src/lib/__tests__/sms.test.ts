import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const logCreate = vi.fn()
const orderFindMany = vi.fn()
const orderFindUnique = vi.fn()
const logFindMany = vi.fn()
vi.mock('../db', () => ({
  prisma: {
    smsMessage: { create: (...a: unknown[]) => logCreate(...a), findMany: (...a: unknown[]) => logFindMany(...a) },
    order: { findMany: (...a: unknown[]) => orderFindMany(...a), findUnique: (...a: unknown[]) => orderFindUnique(...a) },
  },
}))
const env: Record<string, string | undefined> = {}
vi.mock('../env', () => ({ env: new Proxy({}, { get: (_, k: string) => env[k] }) }))
const credits = vi.fn()
const alert = vi.fn()
vi.mock('../smsCredits', async (orig) => ({
  ...(await orig<typeof import('../smsCredits')>()),
  smsCredits: () => credits(),
  checkSmsCreditAlert: (n: number) => alert(n),
}))

const switchedOff = new Set<string>()
vi.mock('../smsSettings', async (orig) => ({
  ...(await orig<typeof import('../smsSettings')>()),
  isSmsSwitchedOff: async (purpose: string) => switchedOff.has(purpose),
}))
const textEmail = vi.fn()
vi.mock('../email', () => ({ emailEnabled: () => true, sendTextEmail: (...a: unknown[]) => textEmail(...a) }))

import { sendMissedOrderPaidSms, sendSms, smsOrEmail } from '../sms'

const fetchMock = vi.fn()
const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))
const opts = { kind: 'transactional' as const, purpose: 'order.paid' }
const loggedStatus = () => logCreate.mock.calls.map(c => (c[0] as { data: { status: string } }).data.status)

beforeEach(() => {
  Object.assign(env, { SMS_PROVIDER: 'smsala', SMSALA_API_TOKEN: 'tok', SMSALA_SENDER_ID: 'NXTSTOP' })
  vi.stubGlobal('fetch', fetchMock)
  logCreate.mockResolvedValue({})
  credits.mockResolvedValue({ bought: 100, used: 10, remaining: 90 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  for (const k of Object.keys(env)) delete env[k]
  switchedOff.clear()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

describe('sendSms via SMSala', () => {
  it('posts the fields as a one-message array, number without the plus, and logs it as sent', async () => {
    reply([{ MessageId: 25, OperationCode: 0, Status: 'Success', Remarks: 'Message Submitted' }])
    await expect(sendSms('0771234567', 'Hello', { ...opts, reference: 'ORD-1' })).resolves.toBe('sent')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api2.smsala.com/SendSmsV2')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual([{
      apiToken: 'tok', messageType: '2', messageEncoding: '0', destinationAddress: '263771234567',
      sourceAddress: 'NXTSTOP', messageText: 'Hello', userReferenceId: 'ORD-1',
    }])
    expect(logCreate.mock.calls[0][0].data).toMatchObject({
      status: 'sent', purpose: 'order.paid', phone: '+26377***567', segments: 1, reference: 'ORD-1',
    })
    expect(alert).toHaveBeenCalledWith(89)
  })

  it('maps OTP and promotional to their message types', async () => {
    reply([{ OperationCode: 0, Status: 'Success' }])
    reply([{ OperationCode: 0, Status: 'Success' }])
    await sendSms('+263771234567', 'a', { ...opts, kind: 'otp' })
    await sendSms('+263771234567', 'b', { ...opts, kind: 'promotional' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0].messageType).toBe('3')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)[0].messageType).toBe('1')
  })

  it('logs a refusal as failed with the reason, without throwing', async () => {
    reply([{ OperationCode: 5, Status: 'Failed', Remarks: 'Insufficient balance' }])
    await expect(sendSms('+263771234567', 'x', opts)).resolves.toBe('failed')
    expect(logCreate.mock.calls[0][0].data).toMatchObject({ status: 'failed', error: expect.stringContaining('Insufficient balance') })
  })

  it('treats an HTTP error with a non-JSON body as failed', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
    await expect(sendSms('+263771234567', 'x', opts)).resolves.toBe('failed')
    expect(logCreate.mock.calls[0][0].data.error).toContain('HTTP 502')
  })
})

describe('sendSms credits', () => {
  it('does not send when credits are used up, logs it and raises the alert', async () => {
    credits.mockResolvedValue({ bought: 100, used: 100, remaining: 0 })
    await expect(sendSms('+263771234567', 'x', opts)).resolves.toBe('no_credit')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(loggedStatus()).toEqual(['no_credit'])
    expect(alert).toHaveBeenCalledWith(0)
  })

  it('does not send when no credits were ever recorded', async () => {
    credits.mockResolvedValue({ bought: 0, used: 0, remaining: 0 })
    await expect(sendSms('+263771234567', 'x', opts)).resolves.toBe('no_credit')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send blind when the credit ledger is unavailable', async () => {
    credits.mockRejectedValue(new Error('relation "SmsTopUp" does not exist'))
    await expect(sendSms('+263771234567', 'x', opts)).resolves.toBe('failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing when SMS is switched off or the number is invalid', async () => {
    delete env.SMS_PROVIDER
    await expect(sendSms('+263771234567', 'x', opts)).resolves.toBe('off')
    env.SMS_PROVIDER = 'smsala'
    await expect(sendSms('12', 'x', opts)).resolves.toBe('invalid')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logCreate).not.toHaveBeenCalled()
  })
})

describe('automatic SMS switches', () => {
  it('sends nothing for a switched-off message', async () => {
    switchedOff.add('order.failed')
    await expect(sendSms('+263771234567', 'x', { ...opts, purpose: 'order.failed' })).resolves.toBe('off')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not apply to promotional campaigns', async () => {
    switchedOff.add('campaign.new-event')
    reply([{ OperationCode: 0, Status: 'Success' }])
    await expect(sendSms('+263771234567', 'x', { kind: 'promotional', purpose: 'campaign.new-event' })).resolves.toBe('sent')
  })
})

describe('smsOrEmail', () => {
  const o = { ...opts, purpose: 'order.refunded', reference: 'ORD-1', subject: 'Refund' }

  it('uses SMS when it goes, without emailing', async () => {
    reply([{ OperationCode: 0, Status: 'Success' }])
    await expect(smsOrEmail('+263771234567', 'a@b.co', 'Hi', o)).resolves.toBe('sms')
    expect(textEmail).not.toHaveBeenCalled()
    expect(loggedStatus()).toEqual(['sent'])
  })

  it('emails the same text when credits are out, logging one row that costs nothing', async () => {
    credits.mockResolvedValue({ bought: 100, used: 100, remaining: 0 })
    textEmail.mockResolvedValue(true)
    await expect(smsOrEmail('+263771234567', 'a@b.co', 'Hi', o)).resolves.toBe('email')
    expect(textEmail).toHaveBeenCalledWith('a@b.co', 'Refund', 'Hi')
    expect(logCreate).toHaveBeenCalledTimes(1)
    expect(logCreate.mock.calls[0][0].data).toMatchObject({ status: 'emailed', segments: 0, reference: 'ORD-1', error: 'no SMS credits' })
  })

  it('emails when the message is switched off or the gateway refuses', async () => {
    textEmail.mockResolvedValue(true)
    switchedOff.add('order.refunded')
    await expect(smsOrEmail('+263771234567', 'a@b.co', 'Hi', o)).resolves.toBe('email')
    switchedOff.clear()
    reply([{ OperationCode: 5, Status: 'Failed', Remarks: 'Insufficient balance' }])
    await expect(smsOrEmail('+263771234567', 'a@b.co', 'Hi', o)).resolves.toBe('email')
    expect(loggedStatus()).toEqual(['emailed', 'emailed'])
    expect(logCreate.mock.calls[1][0].data.error).toContain('Insufficient balance')
  })

  it('reports null and logs the SMS failure when there is no email to fall back to', async () => {
    credits.mockResolvedValue({ bought: 100, used: 100, remaining: 0 })
    await expect(smsOrEmail('+263771234567', null, 'Hi', o)).resolves.toBeNull()
    expect(textEmail).not.toHaveBeenCalled()
    expect(loggedStatus()).toEqual(['no_credit'])
  })
})

describe('credit reserve for codes', () => {
  it('keeps the last credits for sign-in codes', async () => {
    credits.mockResolvedValue({ bought: 100, used: 90, remaining: 10 })
    await expect(sendSms('+263771234567', 'x', opts)).resolves.toBe('no_credit')
    reply([{ OperationCode: 0, Status: 'Success' }])
    await expect(sendSms('+263771234567', '123456', { kind: 'otp', purpose: 'auth.login-code' })).resolves.toBe('sent')
  })
})

describe('sendMissedOrderPaidSms', () => {
  const now = new Date('2026-10-01T10:00:00Z')
  const upcoming: { date: Date; endDate: Date | null } = { date: new Date('2026-10-04T18:00:00Z'), endDate: null }
  const over = { date: new Date('2026-09-30T08:00:00Z'), endDate: new Date('2026-09-30T20:00:00Z') }
  const order = (id: string, event: typeof upcoming) => ({ id, orderNumber: `N-${id}`, tickets: [{ event }] })

  beforeEach(() => {
    orderFindUnique.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve({
      status: 'paid', orderNumber: `N-${where.id}`, total: 10, whatsappPhone: '+263771234567', guestPhone: null,
      user: { phone: '+263771234567' },
      tickets: [{ event: { name: 'Fest', date: upcoming.date } }], vouchers: [],
    }))
  })

  it('texts orders still owed a confirmation, skipping ones already texted or whose event is over', async () => {
    orderFindMany.mockResolvedValue([order('a', upcoming), order('b', upcoming), order('c', over)])
    logFindMany.mockResolvedValue([{ reference: 'N-b' }])
    reply([{ OperationCode: 0, Status: 'Success' }])
    await expect(sendMissedOrderPaidSms(now)).resolves.toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logCreate.mock.calls[0][0].data).toMatchObject({ purpose: 'order.paid', reference: 'N-a', status: 'sent' })
  })

  it('stops once credits run out', async () => {
    credits.mockResolvedValueOnce({ bought: 100, used: 0, remaining: 100 }) // the availability check
      .mockResolvedValue({ bought: 100, used: 100, remaining: 0 })
    orderFindMany.mockResolvedValue([order('a', upcoming), order('b', upcoming)])
    logFindMany.mockResolvedValue([])
    await expect(sendMissedOrderPaidSms(now)).resolves.toBe(0)
    expect(orderFindUnique).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing while payment confirmation SMS is switched off', async () => {
    switchedOff.add('order.paid')
    await expect(sendMissedOrderPaidSms(now)).resolves.toBe(0)
    expect(orderFindMany).not.toHaveBeenCalled()
  })
})
