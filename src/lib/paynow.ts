// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require('paynow')

export type PaynowMethod = 'ecocash' | 'onemoney' | 'innbucks' | 'omari' | 'vmc' | 'standard'

export type InitiateResult =
  | { type: 'redirect'; redirectUrl: string; pollUrl: string }
  | { type: 'mobile'; instructions: string; pollUrl: string }
  | { type: 'innbucks'; innbucksCode: string; pollUrl: string }

function createClient() {
  const client = new Paynow(
    process.env.PAYNOW_INTEGRATION_ID!,
    process.env.PAYNOW_INTEGRATION_KEY!
  )
  // Strip any trailing slash so we never produce double-slash URLs (e.g. https://app.com//api/...)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  client.resultUrl = `${appUrl}/api/paynow/webhook`
  client.returnUrl = `${appUrl}/dashboard/tickets`
  return client
}

/**
 * Initiate a Paynow payment.
 * Returns the appropriate response type based on the chosen method.
 */
export async function initiatePaynowPayment(opts: {
  orderNumber: string
  email: string
  description: string
  amount: number
  method: PaynowMethod
  phone?: string
}): Promise<InitiateResult> {
  const client = createClient()
  const payment = client.createPayment(opts.orderNumber, opts.email)
  payment.add(opts.description, opts.amount)

  if (opts.method === 'standard') {
    const response = await client.send(payment)
    // The paynow library swallows axios errors and returns undefined — treat as network failure
    if (!response) throw new Error('No response from Paynow — possible network error. Please try again.')
    if (!response.success) throw new Error(response.error ?? 'Paynow initiation failed')
    return { type: 'redirect', redirectUrl: response.redirectUrl, pollUrl: response.pollUrl }
  }

  if (!opts.phone) throw new Error('Phone number is required for mobile payments')
  const response = await client.sendMobile(payment, opts.phone, opts.method)
  // The paynow library swallows axios errors and returns undefined — treat as network failure
  if (!response) throw new Error('No response from Paynow — possible network error. Please try again.')
  if (!response.success) throw new Error(response.error ?? 'Paynow mobile initiation failed')

  if (opts.method === 'innbucks') {
    // Innbucks code is stored in innbucks_info[0].authorizationcode by the library
    const innbucksCode = response.innbucks_info?.[0]?.authorizationcode ?? response.instructions ?? ''
    return { type: 'innbucks', innbucksCode, pollUrl: response.pollUrl }
  }

  return {
    type: 'mobile',
    instructions: response.instructions ?? 'Check your phone to complete payment.',
    pollUrl: response.pollUrl,
  }
}

export type PollStatus = 'paid' | 'failed' | 'cancelled' | 'pending'

/**
 * Poll Paynow for the current status of a transaction.
 * Returns a full status so callers can detect failure, not just success.
 */
export async function pollPaynowTransaction(pollUrl: string): Promise<PollStatus> {
  const client = createClient()
  const res = await client.pollTransaction(pollUrl)
  // pollTransaction returns an InitResponse — check .status directly (no .paid() method exists)
  const s: string = (res?.status ?? '').toLowerCase()
  if (s === 'paid') return 'paid'
  if (['failed', 'voided', 'error', 'disputed', 'cancelled'].includes(s)) return 'failed'
  return 'pending'
}
