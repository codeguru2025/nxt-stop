import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const logCreate = vi.fn()
vi.mock('../db', () => ({ prisma: { smsMessage: { create: (...a: unknown[]) => logCreate(...a) } } }))
const env: Record<string, string | undefined> = {}
vi.mock('../env', () => ({ env: new Proxy({}, { get: (_, k: string) => env[k] }) }))
const credits = vi.fn()
const alert = vi.fn()
vi.mock('../smsCredits', async (orig) => ({
  ...(await orig<typeof import('../smsCredits')>()),
  smsCredits: () => credits(),
  checkSmsCreditAlert: (n: number) => alert(n),
}))

import { sendSms } from '../sms'

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
