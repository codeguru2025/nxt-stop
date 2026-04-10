'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, QrCode, Loader2, Check, X, Trash2, Eye, EyeOff } from 'lucide-react'

type StaffMember = {
  id: string
  name: string
  phone: string
  createdAt: string
}

export default function GateStaffClient() {
  const router = useRouter()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', password: '' })

  const load = () => {
    fetch('/api/admin/gate-staff').then(r => r.json()).then(d => {
      if (d.success) setStaff(d.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || d.data.role !== 'admin') { router.push('/login'); return }
      load()
    })
  }, [router])

  const save = async () => {
    setFormError('')
    if (!form.name || !form.phone || !form.password) {
      setFormError('All fields are required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/gate-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())
    setSaving(false)
    if (res.success) {
      setForm({ name: '', phone: '', password: '' })
      setShowForm(false)
      load()
    } else {
      setFormError(res.error ?? 'Failed to create account')
    }
  }

  const revoke = async (id: string) => {
    if (!confirm('Remove this gate staff account? They will lose all access immediately.')) return
    setDeletingId(id)
    await fetch(`/api/admin/gate-staff/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    load()
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Gate Staff</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Accounts with gate scanner access only — no admin privileges
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError('') }}
            className="flex items-center gap-2 btn-primary text-sm"
          >
            <Plus size={16} /> Add Staff
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-1">New Gate Staff Account</h3>
            <p className="text-gray-500 text-sm mb-4">
              This account can only access <span className="text-white font-mono">/gate</span> — no admin panel access.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label>Full Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Staff name"
                />
              </div>
              <div>
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+263 77 123 4567"
                />
              </div>
              <div>
                <label>Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {formError && (
              <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {formError}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Create Account
              </button>
              <button
                onClick={() => { setShowForm(false); setFormError('') }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2 transition-colors"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Staff list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : staff.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <QrCode size={24} className="text-purple-400" />
            </div>
            <h3 className="font-bold text-white mb-1">No gate staff yet</h3>
            <p className="text-gray-500 text-sm mb-4">Create accounts for staff who will scan tickets at the door.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm inline-flex items-center gap-2">
              <Plus size={14} /> Add First Staff Member
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#2a2a2a]">
                  <tr className="text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Access</th>
                    <th className="text-left px-4 py-3">Added</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {staff.map(s => (
                    <tr key={s.id} className="hover:bg-white/2">
                      <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{s.phone}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-md px-2 py-0.5">
                          <QrCode size={11} /> Gate Scanner Only
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => revoke(s.id)}
                          disabled={deletingId === s.id}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg px-2.5 py-1.5 transition-colors ml-auto"
                        >
                          {deletingId === s.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Trash2 size={12} />}
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 card p-4 flex items-start gap-3">
          <QrCode size={16} className="text-purple-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-500">
            Gate staff log in at <span className="text-white font-mono">/login</span> with their phone number and password.
            They are automatically redirected to the gate scanner and cannot access any admin pages.
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
