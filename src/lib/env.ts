/**
 * Centralized environment validation.
 * All values are lazy getters so they are only evaluated at request time,
 * not during `next build` (where env vars are not available).
 */

import { appUrl } from './utils'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  get JWT_SECRET()            { return required('JWT_SECRET') },
  get DATABASE_URL()          { return required('DATABASE_URL') },
  get PAYNOW_INTEGRATION_ID() { return required('PAYNOW_INTEGRATION_ID') },
  get PAYNOW_INTEGRATION_KEY(){ return required('PAYNOW_INTEGRATION_KEY') },

  get PAYNOW_EMAIL()    { return required('PAYNOW_EMAIL') },
  get META_WHATSAPP_TOKEN() { return process.env.META_WHATSAPP_TOKEN },
  get META_WHATSAPP_PHONE_NUMBER_ID() {
    return process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? process.env.WHATSAPP_PHONE_NUMBER_ID
  },
  get WHATSAPP_TEMPLATE_NAME() { return process.env.WHATSAPP_TEMPLATE_NAME },
  get WHATSAPP_TEMPLATE_LANG() { return process.env.WHATSAPP_TEMPLATE_LANG ?? 'en' },
  get WHATSAPP_WEBHOOK_VERIFY_TOKEN() { return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN },
  get META_APP_SECRET() { return process.env.META_APP_SECRET },
  get REDIS_URL()       { return process.env.REDIS_URL },
  get APP_URL()         { return appUrl() },
  get SEED_SECRET()     { return process.env.SEED_SECRET },

  get DO_SPACES_KEY()      { return process.env.DO_SPACES_KEY },
  get DO_SPACES_SECRET()   { return process.env.DO_SPACES_SECRET },
  get DO_SPACES_ENDPOINT() { return process.env.DO_SPACES_ENDPOINT },
  get DO_SPACES_BUCKET()   { return process.env.DO_SPACES_BUCKET },
  get DO_SPACES_REGION()   { return process.env.DO_SPACES_REGION },

  // SMS gateway name (see PROVIDERS in sms.ts); unset = SMS off
  get SMS_PROVIDER()          { return process.env.SMS_PROVIDER?.trim().toLowerCase() || undefined },
  get SMSALA_API_TOKEN()      { return process.env.SMSALA_API_TOKEN },
  get SMSALA_SENDER_ID()      { return process.env.SMSALA_SENDER_ID },

  get RESEND_API_KEY()      { return process.env.RESEND_API_KEY },
  get EMAIL_FROM()            { return process.env.EMAIL_FROM },
  get ADMIN_DIGEST_EMAILS()   { return process.env.ADMIN_DIGEST_EMAILS },
  get ADMIN_DIGEST_HOUR_UTC() { return process.env.ADMIN_DIGEST_HOUR_UTC ?? '6' },

  // Web Push (admin alerts, e.g. failed payments). Generate with: npx web-push generate-vapid-keys
  get VAPID_PUBLIC_KEY()  { return process.env.VAPID_PUBLIC_KEY },
  get VAPID_PRIVATE_KEY() { return process.env.VAPID_PRIVATE_KEY },
  get VAPID_SUBJECT()     { return process.env.VAPID_SUBJECT ?? 'mailto:admin@nxtstop.com' },
} as const
