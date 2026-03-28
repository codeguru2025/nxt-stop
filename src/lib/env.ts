/**
 * Centralized environment validation.
 * All values are lazy getters so they are only evaluated at request time,
 * not during `next build` (where env vars are not available).
 */

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

  get PAYNOW_EMAIL()    { return process.env.PAYNOW_EMAIL ?? 'gustozw@gmail.com' },
  get REDIS_URL()       { return process.env.REDIS_URL },
  get APP_URL()         { return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000' },
  get SEED_SECRET()     { return process.env.SEED_SECRET },

  get DO_SPACES_KEY()      { return process.env.DO_SPACES_KEY },
  get DO_SPACES_SECRET()   { return process.env.DO_SPACES_SECRET },
  get DO_SPACES_ENDPOINT() { return process.env.DO_SPACES_ENDPOINT },
  get DO_SPACES_BUCKET()   { return process.env.DO_SPACES_BUCKET },
  get DO_SPACES_REGION()   { return process.env.DO_SPACES_REGION },
} as const
