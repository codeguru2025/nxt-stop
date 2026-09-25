// Switched-off features whose code is kept for later. Flip a flag to bring one back.
export const FEATURES = {
  /** Points for referral sales and the points Rewards Shop. Off: link rewards are cash only. */
  points: false,
  /**
   * Per-partner commission rates (Admin → Partners). Off: a sale through a partner's code
   * pays the same flat % of the purchase as any other link, to the partner's own account.
   */
  partnerCommissionRates: false,
} as const
