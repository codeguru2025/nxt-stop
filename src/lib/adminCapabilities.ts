// Admin-panel sections an admin account can be granted access to. Kept dependency-free
// (no server-only imports) so both server code (lib/auth.ts) and client components
// (AdminLayout, AdminsClient) can import it directly.
export const ADMIN_CAPABILITIES = [
  'stats', 'events', 'partners', 'store', 'rewards', 'founders',
  'tickets', 'gallery', 'videos', 'gate_staff', 'admins', 'password_resets',
  'referrals', 'teams',
] as const

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number]

export function isAdminCapability(value: string): value is AdminCapability {
  return (ADMIN_CAPABILITIES as readonly string[]).includes(value)
}

export const ADMIN_CAPABILITY_LABELS: Record<AdminCapability, string> = {
  stats: 'Overview / Stats',
  events: 'Events',
  partners: 'Partners',
  store: 'Store',
  rewards: 'Rewards',
  founders: 'Founders',
  tickets: 'Tickets & Orders',
  gallery: 'Gallery',
  videos: 'Past Videos',
  gate_staff: 'Gate Staff',
  admins: 'Admins',
  password_resets: 'Password Resets',
  referrals: 'Referrals',
  teams: 'Teams',
}
