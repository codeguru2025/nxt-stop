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
  client.resultUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/paynow/webhook`
  client.returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/tickets`
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
    if (!response.success) throw new Error(response.error ?? 'Paynow initiation failed')
    return { type: 'redirect', redirectUrl: response.redirectUrl, pollUrl: response.pollUrl }
  }

  if (!opts.phone) throw new Error('Phone number is required for mobile payments')
  const response = await client.sendMobile(payment, opts.phone, opts.method)
  if (!response.success) throw new Error(response.error ?? 'Paynow mobile initiation failed')

  if (opts.method === 'innbucks') {
    return {
      type: 'innbucks',
      innbucksCode: response.data?.innbucksCode ?? response.instructions ?? '',
      pollUrl: response.pollUrl,
    }
  }

  return {
    type: 'mobile',
    instructions: response.instructions ?? 'Check your phone to complete payment.',
    pollUrl: response.pollUrl,
  }
}

/**
 * Poll Paynow for the current status of a transaction.
 * Returns true if the transaction is confirmed paid.
 */
export async function pollPaynowTransaction(pollUrl: string): Promise<boolean> {
  const client = createClient()
  const status = await client.pollTransaction(pollUrl)
  return status.paid()
}
