import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const send = vi.fn()
vi.mock('resend', () => ({ Resend: class { emails = { send: (...a: unknown[]) => send(...a) } } }))
const orderFindUnique = vi.fn()
const orderUpdate = vi.fn()
const orderFindMany = vi.fn()
vi.mock('../db', () => ({
  prisma: {
    order: {
      findUnique: (...a: unknown[]) => orderFindUnique(...a),
      update: (...a: unknown[]) => orderUpdate(...a),
      findMany: (...a: unknown[]) => orderFindMany(...a),
    },
  },
}))
vi.mock('../env', () => ({ env: { RESEND_API_KEY: 're_test', EMAIL_FROM: 'NXT STOP <tickets@example.com>', APP_URL: 'https://example.com' } }))
vi.mock('../ticketAttachment', () => ({ createTicketAttachmentPng: async () => Buffer.from('png') }))
vi.mock('../auditLogPdf', () => ({ createAuditLogPdf: vi.fn() }))

import { sendMissedPurchaseEmails, sendOrderConfirmationEmail, sendTextEmail } from '../email'

const refused = (name: string) => ({ data: null, error: { name, message: `${name} happened` } })

const paidOrder = {
  id: 'o1', status: 'paid', orderNumber: 'NXT-1', total: 20, email: 'buyer@example.com',
  recipientName: null, whatsappName: null,
  user: { name: 'Tendai', email: null },
  tickets: [{
    ticketNumber: 'T-1', status: 'valid', qrCode: 'qr',
    event: { name: 'Fest', venue: 'Park', address: null, date: new Date(), endDate: null, posterImage: null },
    ticketType: { name: 'General', color: null, price: 20 },
  }],
}

beforeEach(() => {
  orderFindUnique.mockResolvedValue(paidOrder)
  orderUpdate.mockResolvedValue({})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

describe('ticket email', () => {
  it('records the email as sent only once Resend accepts it', async () => {
    send.mockResolvedValue({ data: { id: 'e1' }, error: null })
    await sendOrderConfirmationEmail('o1')
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'buyer@example.com', attachments: [{ filename: 'T-1.png' }] })
    expect(orderUpdate).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { emailSentAt: expect.any(Date) } })
  })

  it('throws and leaves it unsent when Resend refuses it', async () => {
    send.mockResolvedValue(refused('validation_error'))
    await expect(sendOrderConfirmationEmail('o1')).rejects.toThrow('validation_error')
    expect(send).toHaveBeenCalledTimes(1)
    expect(orderUpdate).not.toHaveBeenCalled()
  })

  it('waits and retries when sending too fast', async () => {
    vi.useFakeTimers()
    send.mockResolvedValueOnce(refused('rate_limit_exceeded')).mockResolvedValue({ data: { id: 'e1' }, error: null })
    const done = sendOrderConfirmationEmail('o1')
    await vi.runAllTimersAsync()
    await done
    expect(send).toHaveBeenCalledTimes(2)
    expect(orderUpdate).toHaveBeenCalled()
  })

  it('gives up after repeated rate limits', async () => {
    vi.useFakeTimers()
    send.mockResolvedValue(refused('rate_limit_exceeded'))
    const done = expect(sendOrderConfirmationEmail('o1')).rejects.toThrow('rate_limit_exceeded')
    await vi.runAllTimersAsync()
    await done
    expect(send).toHaveBeenCalledTimes(4)
    expect(orderUpdate).not.toHaveBeenCalled()
  })
})

describe('sendTextEmail', () => {
  it('reports a refused email as not sent', async () => {
    send.mockResolvedValue(refused('invalid_from_address'))
    await expect(sendTextEmail('a@b.co', 'Hi', 'text')).resolves.toBe(false)
  })
})

describe('sendMissedPurchaseEmails', () => {
  const now = new Date('2026-10-01T10:00:00Z')

  it('emails tickets for events still to come, skipping ones already emailed or over', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', emailSentAt: null, voucherEmailSentAt: null, tickets: [{ event: { date: new Date('2026-10-04T18:00:00Z'), endDate: null } }], _count: { vouchers: 0 } },
      { id: 'o2', emailSentAt: null, voucherEmailSentAt: null, tickets: [{ event: { date: new Date('2026-09-30T08:00:00Z'), endDate: new Date('2026-09-30T20:00:00Z') } }], _count: { vouchers: 0 } },
      { id: 'o3', emailSentAt: new Date(), voucherEmailSentAt: null, tickets: [{ event: { date: new Date('2026-10-04T18:00:00Z'), endDate: null } }], _count: { vouchers: 0 } },
    ])
    send.mockResolvedValue({ data: { id: 'e1' }, error: null })
    await expect(sendMissedPurchaseEmails('u1', now)).resolves.toBe(1)
    expect(orderFindUnique).toHaveBeenCalledTimes(1)
    expect(orderFindUnique.mock.calls[0][0].where).toEqual({ id: 'o1' })
    expect(orderFindMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', status: 'paid', email: null })
  })

  it('keeps going when one email fails', async () => {
    const upcoming = { tickets: [{ event: { date: new Date('2026-10-04T18:00:00Z'), endDate: null } }], _count: { vouchers: 0 }, emailSentAt: null, voucherEmailSentAt: null }
    orderFindMany.mockResolvedValue([{ id: 'o1', ...upcoming }, { id: 'o2', ...upcoming }])
    send.mockResolvedValueOnce(refused('validation_error')).mockResolvedValue({ data: { id: 'e1' }, error: null })
    await expect(sendMissedPurchaseEmails('u1', now)).resolves.toBe(1)
  })
})
