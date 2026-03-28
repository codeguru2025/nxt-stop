/**
 * Centralized environment validation.
 * Required vars throw at module load so the process fails fast at startup.
 * Optional vars degrade gracefully or throw only when the feature is used.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback
}

// Checked at startup — these crash the app if missing
const JWT_SECRET   = required('JWT_SECRET')
const DATABASE_URL = required('DATABASE_URL')

export const env = {
  JWT_SECRET,
  DATABASE_URL,

  // Redis (optional — rate limiting degrades gracefully without it)
  REDIS_URL: optional('REDIS_URL'),

  // Paynow — validated lazily when first payment is initiated
  get PAYNOW_INTEGRATION_ID()  { return required('PAYNOW_INTEGRATION_ID') },
  get PAYNOW_INTEGRATION_KEY() { return required('PAYNOW_INTEGRATION_KEY') },
  PAYNOW_EMAIL: optional('PAYNOW_EMAIL', 'gustozw@gmail.com') as string,

  // DigitalOcean Spaces — optional in dev
  DO_SPACES_KEY:      optional('DO_SPACES_KEY'),
  DO_SPACES_SECRET:   optional('DO_SPACES_SECRET'),
  DO_SPACES_ENDPOINT: optional('DO_SPACES_ENDPOINT'),
  DO_SPACES_BUCKET:   optional('DO_SPACES_BUCKET'),
  DO_SPACES_REGION:   optional('DO_SPACES_REGION'),

  APP_URL: optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000') as string,

  // Used only in seed route
  SEED_SECRET: optional('SEED_SECRET'),
} as const
