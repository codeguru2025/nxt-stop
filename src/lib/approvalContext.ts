import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Set only while an approved ChangeRequest is being replayed (lib/approvals.ts).
 * Inside it, getSession() returns the *requester* — so the route re-checks that the
 * requester still holds the role/capability — and holdForApproval() lets the change
 * through. Nothing outside the server process can set it: it isn't a header or cookie.
 */
export type ApprovalReplay = { changeRequestId: string; requesterId: string; reviewerId: string }

export const approvalContext = new AsyncLocalStorage<ApprovalReplay>()
