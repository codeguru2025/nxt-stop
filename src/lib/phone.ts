function digitsOnly(input: string): string {
  return input.replace(/[^\d+]/g, '')
}

export function normalizeWhatsAppPhone(raw: string, defaultCountryCode = '+263'): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let cleaned = digitsOnly(trimmed)
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`

  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = `${defaultCountryCode}${cleaned.slice(1)}`
    } else {
      cleaned = `+${cleaned}`
    }
  }

  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null

  return `+${digits}`
}

export function toWhatsAppRecipient(phone: string): string {
  return phone.replace(/\D/g, '')
}
