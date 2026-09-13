// Direct EcoCash "dial-to-pay" flow: the buyer's own phone dials a prefilled USSD
// code to send money straight to the merchant's EcoCash line. No Paynow involved.
// Confirmation of payment comes later, out of band, from src/app/api/ecocash/sms-webhook.

export function buildUssdCode(merchantNumber: string, amount: number): string {
  // *153*1*1*<merchant number>*<amount># — EcoCash's own "send money" quick-dial menu
  return `*153*1*1*${merchantNumber}*${amount.toFixed(2)}#`
}

export function buildUssdLink(ussdCode: string): string {
  // tel: links must percent-encode '#' — a literal '#' would be parsed as a URL fragment
  // and get silently dropped, dialing an incomplete (and on some networks dangerous) code.
  return `tel:${encodeURIComponent(ussdCode).replace(/%2A/g, '*')}`
}

export type ParsedEcocashSms = {
  amount: number
  payerPhone?: string
  txRef?: string
}

// EcoCash confirmation SMS wording varies by network update. This covers the common
// "received money" shapes seen in Zimbabwe; treat it as a best-effort parse — anything
// that doesn't match, or matches ambiguously, is logged for manual admin review rather
// than silently dropped or guessed. Tune these patterns against real sample SMS text.
export function parseEcocashSms(text: string): ParsedEcocashSms | null {
  const normalized = text.replace(/\s+/g, ' ').trim()

  // Amount: "$10.00", "USD 10.00", "10.00"
  const amountMatch = normalized.match(/(?:US\$|\$|USD)\s?([\d,]+\.\d{2})/i)
  if (!amountMatch) return null
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null

  // Payer phone: 07xxxxxxxx or 2637xxxxxxxx or +2637xxxxxxxx
  const phoneMatch = normalized.match(/(?:\+?263|0)7\d{8}/)
  const payerPhone = phoneMatch?.[0]

  // Transaction reference: EcoCash confirmations typically carry an alphanumeric
  // reference after a label like "TxID", "Trans ID", "Ref", or "Confirmation".
  const refMatch = normalized.match(/(?:TxID|Trans(?:action)?\s*ID|Ref(?:erence)?|Confirmation)\s*[:.]?\s*([A-Z0-9.\-]{6,})/i)
  const txRef = refMatch?.[1]

  return { amount, payerPhone, txRef }
}

// Loosely matches on the last 9 digits so it doesn't matter whether the number is
// stored as 0773..., 263773..., or +263773...
export function phonesLooselyMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const tailA = a.replace(/\D/g, '').slice(-9)
  const tailB = b.replace(/\D/g, '').slice(-9)
  return tailA.length === 9 && tailA === tailB
}
