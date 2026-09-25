import { describe, it, expect, vi, beforeEach } from 'vitest'

const crCreate = vi.fn()
vi.mock('../db', () => ({
  prisma: {
    changeRequest: { findFirst: async () => null, create: (...a: unknown[]) => crCreate(...a) },
    user: { findMany: async () => [] },
  },
}))
vi.mock('../env', () => ({ env: { JWT_SECRET: 'test-secret' } }))
const audit = vi.fn()
vi.mock('../auditLog', () => ({ writeAuditLog: (...a: unknown[]) => audit(...a) }))
vi.mock('../push', () => ({ notifyAdmins: async () => {} }))
let creatorId = 'creator'
vi.mock('../platformCreator', () => ({ isPlatformCreator: async (id: string) => id === creatorId }))

import { holdForApproval } from '../approvals'

const opts = {
  action: 'event.update', capability: 'events' as const, route: '/api/admin/events/[id]' as const,
  params: { id: 'e1' }, body: { name: 'New' }, entityType: 'Event', entityId: 'e1',
  describe: async () => ({ title: 'Rename event', changes: [{ label: 'Name', from: 'Old', to: 'New' }] }),
}
const session = (id: string) => ({ id, name: id, role: 'admin' }) as never
const req = () => new Request('http://x/api/admin/events/e1', { method: 'PATCH' })

beforeEach(() => {
  creatorId = 'creator'
  crCreate.mockReset().mockResolvedValue({ id: 'cr1' })
  audit.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('holdForApproval and the platform creator', () => {
  it('lets the creator\'s change go live without approval, and audit-logs it', async () => {
    expect(await holdForApproval(req(), session('creator'), opts)).toBeNull()
    expect(crCreate).not.toHaveBeenCalled()
    expect(audit.mock.calls[0][0]).toMatchObject({ action: 'change.creator-direct', actorId: 'creator', after: { title: 'Rename event' } })
  })

  it('still holds an owner\'s change for approval', async () => {
    const res = await holdForApproval(req(), session('owner'), opts)
    expect(res?.status).toBe(202)
    expect(crCreate).toHaveBeenCalledOnce()
  })
})
