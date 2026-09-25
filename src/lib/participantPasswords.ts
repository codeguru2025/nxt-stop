// Rules for handing a line-up member a new one-time password from the event editor.

export type PasswordAccount = {
  mustResetPassword: boolean
  passwordSetAt: Date | null
  role: string
  _count: { orders: number; tickets: number }
}

/**
 * A real password the person knows: one they chose, or one an admin set when creating
 * the account (Admin → Partners) — those never carry mustResetPassword.
 */
export function hasOwnPassword(u: PasswordAccount): boolean {
  return !!u.passwordSetAt || !u.mustResetPassword
}

/**
 * A fresh one-time password may only replace one on an account that exists just for the
 * line-up: still on a system-issued one-time password, no purchases, not staff. That keeps
 * this from becoming a way for an events admin to take over anyone else's account.
 */
export function canIssuePassword(u: PasswordAccount): boolean {
  return !hasOwnPassword(u) && u._count.orders === 0 && u._count.tickets === 0 && (u.role === 'customer' || u.role === 'partner')
}
