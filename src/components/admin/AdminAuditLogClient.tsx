'use client'

import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { ScrollText, Lock, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

type Row = {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  entityType: string
  entityId: string | null
  before: unknown
  after: unknown
  ip: string | null
  path: string | null
  createdAt: string
}

export default function AdminAuditLogClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = (after?: string) => {
    const url = after ? `/api/admin/audit-log?cursor=${after}` : '/api/admin/audit-log'
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { setForbidden(true); return }
        setRows(prev => (after ? [...prev, ...d.data.rows] : d.data.rows))
        setCursor(d.data.nextCursor)
      })
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }

  useEffect(() => { load() }, [])

  if (forbidden) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div className="card p-8 text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Lock size={24} className="text-red-400" />
            </div>
            <h3 className="font-bold text-white mb-1">Owner Only</h3>
            <p className="text-gray-500 text-sm">Only platform owner accounts (owner and creator) can view the audit log.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <ScrollText size={20} className="text-purple-400" />
            Audit Log
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Every logged action — insert-only, nothing here can ever be edited or deleted.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="card p-10 text-center">
            <ScrollText size={40} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nothing logged yet</p>
          </div>
        ) : (
          <div className="card divide-y divide-[#2a2a2a] overflow-hidden">
            {rows.map(row => (
              <div key={row.id} className="p-4 text-sm">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="font-semibold text-white">{row.action}</span>
                  <span className="text-gray-600 text-xs shrink-0">{formatDateTime(row.createdAt)}</span>
                </div>
                <div className="text-gray-500 text-xs">
                  {row.entityType}{row.entityId ? ` #${row.entityId}` : ''}
                  {row.actorId ? ` · by ${row.actorId} (${row.actorRole})` : ' · unauthenticated'}
                  {row.ip ? ` · ${row.ip}` : ''}
                  {row.path ? ` · ${row.path}` : ''}
                </div>
                {(row.before != null || row.after != null) && (
                  <pre className="mt-2 text-xs text-gray-600 bg-[#111] rounded-lg p-2 overflow-x-auto">
                    {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {cursor && (
          <button
            onClick={() => { setLoadingMore(true); load(cursor) }}
            disabled={loadingMore}
            className="mt-4 w-full flex items-center justify-center gap-2 border border-[#2a2a2a] rounded-xl py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
            Load more
          </button>
        )}
      </div>
    </AdminLayout>
  )
}
