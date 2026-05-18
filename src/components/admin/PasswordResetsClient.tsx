'use client'

import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { KeyRound, Check, X, Loader2, Eye, EyeOff, Phone, Clock, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Request = {
  id: string
  reason: string | null
  ip: string | null
  createdAt: string
  status: string
  user: {
    id: string
    name: string
    phone: string
    role: string
    createdAt: string
    _count: { tickets: number; orders: number }
  }
}

export default function PasswordResetsClient() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<Record<string, 'approved' | 'rejected'>>({})
  const [error, setError] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    fetch('/api/admin/password-resets')
      .then(r => r.json())
      .then(d => { if (d.success) setRequests(d.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const getCsrf = () =>
    document.cookie.split('; ').find(r => r.startsWith('csrf-token='))?.split('=')[1]

  const process = async (id: string, action: 'approve' | 'reject') => {
    const pw = passwords[id] ?? ''
    if (action === 'approve' && pw.length < 8) {
      setError(prev => ({ ...prev, [id]: 'Password must be at least 8 characters' }))
      return
    }
    setProcessing(id)
    setError(prev => ({ ...prev, [id]: '' }))

    const res = await fetch(`/api/admin/password-resets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() ?? '' },
      body: JSON.stringify({ action, password: pw }),
    }).then(r => r.json())

    setProcessing(null)
    if (res.success) {
      setDone(prev => ({ ...prev, [id]: action === 'approve' ? 'approved' : 'rejected' }))
      setTimeout(() => setRequests(prev => prev.filter(r => r.id !== id)), 1500)
    } else {
      setError(prev => ({ ...prev, [id]: res.error ?? 'Failed' }))
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <KeyRound size={20} className="text-yellow-400" />
              Password Reset Requests
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Verify the user then set a new temporary password</p>
          </div>
          <button onClick={load} className="text-xs text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1.5 transition-colors">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="card p-10 text-center">
            <KeyRound size={40} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No pending requests</p>
            <p className="text-gray-700 text-sm mt-1">All password reset requests have been handled</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => {
              const isDone = !!done[req.id]
              const isApproved = done[req.id] === 'approved'
              const isProcessing = processing === req.id

              return (
                <div
                  key={req.id}
                  className={`card p-5 transition-all ${isDone ? (isApproved ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5') : ''}`}
                >
                  {/* User info */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-white font-bold text-base">{req.user.name}</div>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-0.5">
                        <Phone size={12} />
                        {req.user.phone}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-600">
                        <span>{req.user._count.tickets} ticket{req.user._count.tickets !== 1 ? 's' : ''}</span>
                        <span>{req.user._count.orders} order{req.user._count.orders !== 1 ? 's' : ''}</span>
                        <span>Joined {formatDate(req.user.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
                      <Clock size={11} />
                      {formatDate(req.createdAt)}
                    </div>
                  </div>

                  {req.reason && (
                    <div className="bg-[#1a1a1a] rounded-xl p-3 mb-4 text-sm text-gray-400 italic border border-[#2a2a2a]">
                      "{req.reason}"
                    </div>
                  )}

                  {isDone ? (
                    <div className={`flex items-center gap-2 text-sm font-semibold ${isApproved ? 'text-green-400' : 'text-red-400'}`}>
                      {isApproved ? <><Check size={16} /> Password reset — notify the user</> : <><X size={16} /> Request rejected</>}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">New temporary password</label>
                        <div className="relative">
                          <input
                            type={showPw[req.id] ? 'text' : 'password'}
                            placeholder="min 8 characters"
                            value={passwords[req.id] ?? ''}
                            onChange={e => setPasswords(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showPw[req.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      {error[req.id] && (
                        <div className="flex items-center gap-1.5 text-red-400 text-xs">
                          <AlertCircle size={12} /> {error[req.id]}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => process(req.id, 'approve')}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/20 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Reset Password
                        </button>
                        <button
                          onClick={() => process(req.id, 'reject')}
                          disabled={isProcessing}
                          className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>

                      <p className="text-xs text-gray-600">
                        ⚠️ Verify you know this person before resetting. Call them on {req.user.phone} if unsure.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
