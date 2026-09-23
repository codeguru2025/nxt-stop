// What the public may know about ticket availability. Sales numbers (sold, capacity,
// tickets issued) never leave the server — only these coarse flags do, so the numbers
// can't be read from the page or the public API either.

/** Remaining at or below this shows "Almost sold out". */
export const ALMOST_SOLD_OUT_AT = 20
/** Most tickets one order may include. */
export const MAX_PER_ORDER = 10

export type PublicAvailability = {
  soldOut: boolean
  almostSoldOut: boolean
  /** Cap for the quantity picker: min(MAX_PER_ORDER, remaining). Only reveals stock below 10. */
  maxPerOrder: number
}

export function publicAvailability(capacity: number, sold: number): PublicAvailability {
  const remaining = Math.max(0, capacity - sold)
  return {
    soldOut: remaining === 0,
    almostSoldOut: remaining > 0 && remaining <= ALMOST_SOLD_OUT_AT,
    maxPerOrder: Math.min(MAX_PER_ORDER, remaining),
  }
}

/** Event-level "Selling fast" — more than 80% of all tickets gone. */
export function eventSellingFast(ticketTypes: { capacity: number; sold: number }[]): boolean {
  const cap = ticketTypes.reduce((s, t) => s + t.capacity, 0)
  const sold = ticketTypes.reduce((s, t) => s + t.sold, 0)
  return cap > 0 && sold / cap > 0.8
}
