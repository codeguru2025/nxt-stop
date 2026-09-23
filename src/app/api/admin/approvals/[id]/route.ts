import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { ok, error, forbidden, serverError } from '@/lib/api'
import { decideChangeRequest } from '@/lib/approvals'

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'cancel']),
  note: z.string().trim().max(500).optional(),
})

// PATCH /api/admin/approvals/[id] — approve / reject (another admin) or cancel (the requester)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin().catch(() => null)
    if (!session) return forbidden()
    const { id } = await ctx.params

    const parsed = decisionSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return error('decision must be approve, reject or cancel')

    const result = await decideChangeRequest(id, session, parsed.data.decision, parsed.data.note || null, req)
    if (!result.ok) return error(result.message, result.httpStatus)
    return ok({ status: result.status, message: result.message })
  } catch (e) {
    return serverError(e)
  }
}
