'use client'

import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { ShieldCheck, Check, X, Loader2, Clock, ArrowRight, Undo2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Change = { label: string; from?: string | null; to?: string | null }
type Request = {
  id: string
  title: string
  changes: Change[]
  status: 'pending' | 'applying' | 'applied' | 'rejected' | 'cancelled' | 'expired' | 'failed'
  reviewNote: string | null
  failureReason: string | null
  createdAt: string
  reviewedAt: string | null
  expiresAt: string
  requestedBy: { name: string }
  reviewedBy: { name: string } | null
  mine: boolean
  canDecide: boolean
}

const STATUS: Record<Request['status'], { label: string; cls: string }> = {
  pending: { label: 'Waiting', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  applying: { label: 'Applying…', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  applied: { label: 'Approved — live', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  expired: { label: 'Expired', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  failed: { label: 'Could not apply', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
}

function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <ul className="space-y-1.5">
      {changes.map((c, i) => (
        <li key={i} className="text-sm">
          <span className="text-gray-400">{c.label}: </span>
          {c.from != null && c.from !== '' && (
            <>
              <span className="text-red-300/80 line-through decoration-red-400/50">{c.from}</span>
              <ArrowRight size={12} className="inline mx-1.5 text-gray-600" />
            </>
          )}
          <span className="text-green-300 font-medium">{c.to ?? '—'}</span>
        </li>
      ))}
    </ul>
  )
}

export default function AdminApprovalsClient() {
  const [pending, setPending] = useState<Request[]>([])
  const [recent, setRecent] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ id: string; kind: 'ok' | 'error'; text: string } | null>(null)

  const load = () => {
    fetch('/api/admin/approvals')
      .then(r => r.json())
      .then(d => { if (d.success) { setPending(d.data.pending); setRecent(d.data.recent) } })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const decide = async (id: string, decision: 'approve' | 'reject' | 'cancel') => {
    setBusy(`${id}:${decision}`)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[id] || undefined }),
      }).then(r => r.json())
      setMessage({ id, kind: res.success ? 'ok' : 'error', text: res.success ? res.data.message : res.error ?? 'Something went wrong' })
      window.dispatchEvent(new Event('nxt:approvals-changed'))
      load()
    } catch {
      setMessage({ id, kind: 'error', text: 'Network error — check connection' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-purple-400" />
            Approvals
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Serious changes — editing or deleting events, prices, admin access, payouts and more — only go live once a
            second admin approves them. You can&apos;t approve your own.
          </p>
        </div>

        <h2 className="text-sm text-gray-400 font-semibold uppercase tracking-wider mb-3">Waiting for approval</h2>
        {loading ? (
          <div className="skeleton h-40 rounded-2xl mb-8" />
        ) : pending.length === 0 ? (
          <div className="card p-8 text-center mb-8">
            <Check size={32} className="text-green-500/60 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nothing waiting — all changes are decided</p>
          </div>
        ) : (
          <div className="space-y-4 mb-10">
            {pending.map(r => (
              <div key={r.id} className="card p-5 border-yellow-500/20">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-bold text-white">{r.title}</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0 ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </div>
                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
                  <Clock size={12} />
                  Asked by <span className="text-gray-300">{r.mine ? 'you' : r.requestedBy.name}</span> · {formatDate(r.createdAt, 'EEE d MMM, h:mm a')} · expires {formatDate(r.expiresAt, 'EEE d MMM')}
                </p>
                <div className="bg-[#111] rounded-xl p-4 mb-4">
                  <ChangeList changes={r.changes} />
                </div>

                {r.canDecide ? (
                  <div className="space-y-2">
                    <input
                      placeholder="Note (optional) — e.g. why you're rejecting"
                      value={notes[r.id] ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                      className="w-full text-sm"
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => decide(r.id, 'approve')}
                        disabled={!!busy}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {busy === `${r.id}:approve` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve — make it live
                      </button>
                      <button
                        onClick={() => decide(r.id, 'reject')}
                        disabled={!!busy}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {busy === `${r.id}:reject` ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reject
                      </button>
                    </div>
                  </div>
                ) : r.mine ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">Waiting for another admin to approve.</p>
                    <button
                      onClick={() => decide(r.id, 'cancel')}
                      disabled={!!busy}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 disabled:opacity-50"
                    >
                      {busy === `${r.id}:cancel` ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Cancel my request
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">An admin with access to this section needs to approve it.</p>
                )}

                {message?.id === r.id && (
                  <p className={`text-sm mt-3 ${message.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <h2 className="text-sm text-gray-400 font-semibold uppercase tracking-wider mb-3">Recently decided</h2>
        {message && !pending.some(p => p.id === message.id) && (
          <p className={`text-sm mb-3 ${message.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>
        )}
        {recent.length === 0 ? (
          <p className="text-sm text-gray-600">Nothing yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(r => (
              <details key={r.id} className="card p-4 group">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white">{r.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Asked by {r.mine ? 'you' : r.requestedBy.name}
                      {r.reviewedBy && <> · {r.status === 'rejected' ? 'rejected' : 'approved'} by {r.reviewedBy.name}</>}
                      {r.reviewedAt && <> · {formatDate(r.reviewedAt, 'd MMM, h:mm a')}</>}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0 ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-2">
                  <ChangeList changes={r.changes} />
                  {r.reviewNote && <p className="text-xs text-gray-400">Note: “{r.reviewNote}”</p>}
                  {r.failureReason && <p className="text-xs text-orange-400">Why it wasn&apos;t applied: {r.failureReason}</p>}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
