'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2, Check, X } from 'lucide-react'

type Founder = {
  id: string; name: string; role?: string; bio?: string
  image?: string; order: number; active: boolean
}

export default function FoundersAdmin() {
  const router = useRouter()
  const [founders, setFounders] = useState<Founder[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Founder | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', role: '', bio: '', image: '', order: 0 })

  const load = () => {
    fetch('/api/admin/founders').then(r => r.json()).then(d => {
      if (d.success) setFounders(d.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || d.data.role !== 'admin') { router.push('/login'); return }
      load()
    })
  }, [router])

  const resetForm = () => {
    setForm({ name: '', role: '', bio: '', image: '', order: founders.length })
    setEditing(null)
    setShowForm(false)
  }

  const startEdit = (f: Founder) => {
    setForm({ name: f.name, role: f.role ?? '', bio: f.bio ?? '', image: f.image ?? '', order: f.order })
    setEditing(f)
    setShowForm(true)
  }

  const save = async () => {
    setSaving(true)
    const url = editing ? `/api/admin/founders/${editing.id}` : '/api/admin/founders'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())

    setSaving(false)
    if (res.success) { load(); resetForm() }
  }

  const toggleActive = async (f: Founder) => {
    await fetch(`/api/admin/founders/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !f.active }),
    })
    load()
  }

  const deleteFounder = async (id: string) => {
    if (!confirm('Delete this founder profile?')) return
    await fetch(`/api/admin/founders/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Founders Showcase</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage founder profiles displayed on the public site</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="flex items-center gap-2 btn-primary text-sm"
          >
            <Plus size={16} />
            Add Founder
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-white mb-4">{editing ? 'Edit' : 'Add'} Founder</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label>Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="DJ Nova" />
              </div>
              <div>
                <label>Role / Title</label>
                <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Co-Founder & CEO" />
              </div>
              <div className="sm:col-span-2">
                <label>Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} placeholder="Short biography..." className="resize-none" />
              </div>
              <div>
                <label>Photo URL</label>
                <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label>Display Order</label>
                <input type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            {form.image && (
              <div className="mt-3">
                <img src={form.image} alt="Preview" className="w-16 h-16 rounded-full object-cover border border-[#2a2a2a]" />
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving || !form.name} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editing ? 'Save Changes' : 'Create Profile'}
              </button>
              <button onClick={resetForm} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2 transition-all">
                <X size={14} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Founders list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : founders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">👤</div>
            <p className="text-gray-500">No founder profiles yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {founders.map(f => (
              <div key={f.id} className={`card p-5 transition-all ${!f.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-4 mb-3">
                  {f.image ? (
                    <img src={f.image} alt={f.name} className="w-14 h-14 rounded-2xl object-cover border border-[#2a2a2a] shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-xl">{f.name[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white">{f.name}</div>
                    {f.role && <div className="text-xs text-purple-400 mt-0.5">{f.role}</div>}
                    {f.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{f.bio}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[#2a2a2a]">
                  <span className="text-xs text-gray-600 flex-1">Order: {f.order}</span>
                  <button onClick={() => toggleActive(f)} className="text-gray-500 hover:text-yellow-400 transition-colors" title={f.active ? 'Deactivate' : 'Activate'}>
                    {f.active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => startEdit(f)} className="text-gray-500 hover:text-blue-400 transition-colors">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => deleteFounder(f.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
