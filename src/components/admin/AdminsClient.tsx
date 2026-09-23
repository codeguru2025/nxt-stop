'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, Shield, Loader2, Check, X, Trash2, Eye, EyeOff, Pencil } from 'lucide-react'
import { ADMIN_CAPABILITIES, ADMIN_CAPABILITY_LABELS, type AdminCapability } from '@/lib/adminCapabilities'

type Admin = {
  id: string
  name: string
  phone: string
  email: string | null
  capabilities: AdminCapability[]
  createdAt: string
}

function CapabilityGrid({ selected, onToggle }: { selected: AdminCapability[]; onToggle: (c: AdminCapability) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {ADMIN_CAPABILITIES.map(cap => (
        <label
          key={cap}
          className={`flex items-center gap-2 text-xs rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
            selected.includes(cap)
              ? 'border-purple-500/40 bg-purple-500/10 text-purple-200'
              : 'border-[#2a2a2a] text-gray-400 hover:border-[#3a3a3a]'
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(cap)}
            onChange={() => onToggle(cap)}
            className="accent-purple-500"
          />
          {ADMIN_CAPABILITY_LABELS[cap]}
        </label>
      ))}
    </div>
  )
}

export default function AdminsClient() {
  const router = useRouter()
  const [selfId, setSelfId] = useState('')
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<{ name: string; phone: string; email: string; password: string; capabilities: AdminCapability[] }>(
    { name: '', phone: '', email: '', password: '', capabilities: [] }
  )

  const [editTarget, setEditTarget] = useState<Admin | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; email: string; password: string; capabilities: AdminCapability[] }>(
    { name: '', email: '', password: '', capabilities: [] }
  )
  const [editPwShow, setEditPwShow] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState(false)

  const toggleFormCap = (cap: AdminCapability) =>
    setForm(f => ({ ...f, capabilities: f.capabilities.includes(cap) ? f.capabilities.filter(c => c !== cap) : [...f.capabilities, cap] }))
  const toggleEditCap = (cap: AdminCapability) =>
    setEditForm(f => ({ ...f, capabilities: f.capabilities.includes(cap) ? f.capabilities.filter(c => c !== cap) : [...f.capabilities, cap] }))

  const load = () => {
    fetch('/api/admin/admins').then(r => r.json()).then(d => {
      if (d.success) setAdmins(d.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || d.data.role !== 'admin') { router.push('/login'); return }
      setSelfId(d.data.id)
      load()
    })
  }, [router])

  const save = async () => {
    setFormError('')
    if (!form.name || !form.phone || !form.password) {
      setFormError('Name, phone, and password are required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, email: form.email || undefined }),
    }).then(r => r.json())
    setSaving(false)
    if (res.success || res.pendingApproval) {
      setForm({ name: '', phone: '', email: '', password: '', capabilities: [] })
      setShowForm(false)
      load()
    } else {
      setFormError(res.error ?? 'Failed to create admin')
    }
  }

  const openEdit = (a: Admin) => {
    setEditTarget(a)
    setEditForm({ name: a.name, email: a.email ?? '', password: '', capabilities: a.capabilities })
    setEditError('')
    setEditSuccess(false)
  }

  const saveEdit = async () => {
    if (!editTarget) return
    if (editForm.password && editForm.password.length < 8) {
      setEditError('Password must be at least 8 characters')
      return
    }
    setEditSaving(true)
    setEditError('')
    const body: { name?: string; email?: string | null; password?: string; capabilities?: AdminCapability[] } = {
      name: editForm.name,
      email: editForm.email || null,
      capabilities: editForm.capabilities,
    }
    if (editForm.password) body.password = editForm.password
    const res = await fetch(`/api/admin/admins/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json())
    setEditSaving(false)
    if (res.pendingApproval) {
      setEditTarget(null) // held for another admin — AdminLayout shows the notice
    } else if (res.success) {
      setEditSuccess(true)
      load()
      setTimeout(() => { setEditTarget(null); setEditSuccess(false) }, 1200)
    } else {
      setEditError(res.error ?? 'Failed to update admin')
    }
  }

  const revoke = async (a: Admin) => {
    if (!confirm(`Revoke admin access for ${a.name}? They will be downgraded to a regular customer account.`)) return
    setRevokingId(a.id)
    const res = await fetch(`/api/admin/admins/${a.id}`, { method: 'DELETE' }).then(r => r.json())
    setRevokingId(null)
    if (!res.success && !res.pendingApproval) alert(res.error ?? 'Failed to revoke admin access')
    load()
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Admins</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Full admin panel access, including the daily sales/attendance digest email
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError('') }}
            className="flex items-center gap-2 btn-primary text-sm"
          >
            <Plus size={16} /> Add Admin
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-1">New Admin Account</h3>
            <p className="text-gray-500 text-sm mb-4">
              Full access to the admin panel. Add an email so they receive the daily digest.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label>Full Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Admin name"
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
                <label>Email (for digest)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label>Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
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

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-300 mb-2 block">Capabilities</label>
              <CapabilityGrid selected={form.capabilities} onToggle={toggleFormCap} />
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
                Create Admin
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

        {/* Admin list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : admins.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Shield size={24} className="text-purple-400" />
            </div>
            <h3 className="font-bold text-white mb-1">No admins found</h3>
            <p className="text-gray-500 text-sm mb-4">Create accounts for people who need full admin panel access.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm inline-flex items-center gap-2">
              <Plus size={14} /> Add First Admin
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
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Capabilities</th>
                    <th className="text-left px-4 py-3">Added</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {admins.map(a => (
                    <tr key={a.id} className="hover:bg-white/2">
                      <td className="px-4 py-3 font-medium text-white">
                        {a.name}
                        {a.id === selfId && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded px-1.5 py-0.5">You</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{a.phone}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {a.email ?? <span className="text-gray-600 italic">no email — won&apos;t get digest</span>}
                      </td>
                      <td className="px-4 py-3">
                        {a.capabilities.length === 0 ? (
                          <span className="text-xs text-gray-600 italic">none</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {a.capabilities.map(cap => (
                              <span key={cap} className="text-[10px] bg-white/5 text-gray-400 border border-[#2a2a2a] rounded px-1.5 py-0.5">
                                {ADMIN_CAPABILITY_LABELS[cap]}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(a)}
                            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 rounded-lg px-2.5 py-1.5 transition-colors"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            onClick={() => revoke(a)}
                            disabled={revokingId === a.id || a.id === selfId}
                            title={a.id === selfId ? "You can't revoke your own access" : undefined}
                            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {revokingId === a.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Trash2 size={12} />}
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-white mb-1">Edit Admin</h3>
              <p className="text-gray-500 text-sm mb-4">
                Update details for <span className="text-white">{editTarget.name}</span>
              </p>

              <div className="space-y-3">
                <div>
                  <label>Name</label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label>Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="name@example.com"
                    className="w-full"
                  />
                </div>
                <div>
                  <label>New Password (optional)</label>
                  <div className="relative">
                    <input
                      type={editPwShow ? 'text' : 'password'}
                      value={editForm.password}
                      onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Leave blank to keep current password"
                      className="pr-10 w-full"
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    />
                    <button
                      type="button"
                      onClick={() => setEditPwShow(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {editPwShow ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Capabilities</label>
                  <CapabilityGrid selected={editForm.capabilities} onToggle={toggleEditCap} />
                </div>
              </div>

              {editError && <p className="mt-2 text-sm text-red-400">{editError}</p>}
              {editSuccess && (
                <p className="mt-2 text-sm text-green-400 flex items-center gap-1.5">
                  <Check size={14} /> Saved
                </p>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveEdit}
                  disabled={editSaving || editSuccess}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
                <button
                  onClick={() => setEditTarget(null)}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2 transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 card p-4 flex items-start gap-3">
          <Shield size={16} className="text-purple-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-500">
            Admins log in at <span className="text-white font-mono">/login</span> with their phone number and password
            and get full access to this panel. There must always be at least one admin — the last one can&apos;t be revoked.
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
