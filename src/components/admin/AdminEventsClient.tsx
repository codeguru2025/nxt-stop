'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'

const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false })
import {
  Plus, Calendar, MapPin, Ticket, Edit, Trash2,
  CheckCircle, Circle, Loader2, Check, X
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

type Event = {
  id: string; name: string; slug: string; date: string; venue: string
  status: string; ticketTypes: any[]; _count: { tickets: number }
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  published: 'bg-green-500/20 text-green-400',
  live: 'bg-red-500/20 text-red-400 pulse-glow',
  ended: 'bg-gray-700/20 text-gray-600',
  cancelled: 'bg-red-900/20 text-red-700',
}

const BLANK_FORM = {
  name: '', venue: '', address: '', date: '', endDate: '', description: '',
  posterImage: '', bannerImage: '', hasVirtual: false, virtualPrice: 5,
  status: 'draft', lat: '', lng: '',
  ticketTypes: [
    { name: 'General', price: 10, capacity: 500, color: '#8B5CF6' }
  ]
}

export default function AdminEventsClient() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(BLANK_FORM)
  const [editing, setEditing] = useState<string | null>(null)

  const load = () => {
    fetch('/api/admin/events').then(r => r.json()).then(d => {
      if (d.success) setEvents(d.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || d.data.role !== 'admin') { router.push('/login'); return }
      load()
    })
  }, [router])

  const save = async () => {
    setSaving(true)
    const url = editing ? `/api/admin/events/${editing}` : '/api/admin/events'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())

    setSaving(false)
    if (res.success) { load(); setShowForm(false); setEditing(null); setForm(BLANK_FORM) }
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return
    await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
    load()
  }

  const addTicketType = () => {
    setForm((f: any) => ({
      ...f,
      ticketTypes: [...f.ticketTypes, { name: '', price: 0, capacity: 100, color: '#8B5CF6' }]
    }))
  }

  const updateTicketType = (i: number, key: string, value: any) => {
    setForm((f: any) => ({
      ...f,
      ticketTypes: f.ticketTypes.map((t: any, idx: number) => idx === i ? { ...t, [key]: value } : t)
    }))
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Events</h1>
            <p className="text-gray-500 text-sm mt-0.5">{events.length} events</p>
          </div>
          <button onClick={() => { setShowForm(true); setEditing(null); setForm(BLANK_FORM) }} className="flex items-center gap-2 btn-primary text-sm">
            <Plus size={16} />
            Create Event
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="card p-6 mb-6">
            <h3 className="font-bold text-white mb-5">{editing ? 'Edit Event' : 'Create New Event'}</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label>Event Name *</label>
                <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="NXT STOP: Harare Edition" />
              </div>
              <div>
                <label>Venue *</label>
                <input value={form.venue} onChange={e => setForm((f: any) => ({ ...f, venue: e.target.value }))} placeholder="Glamis Arena" />
              </div>
              <div>
                <label>Address</label>
                <input value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} placeholder="7 Grimble Road, Harare" />
              </div>
              <div>
                <label>Date & Time *</label>
                <input type="datetime-local" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label>End Date & Time</label>
                <input type="datetime-local" value={form.endDate} onChange={e => setForm((f: any) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} className="resize-none" placeholder="Event description..." />
              </div>
              <div>
                <label>Poster Image URL</label>
                <input value={form.posterImage} onChange={e => setForm((f: any) => ({ ...f, posterImage: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="sm:col-span-2">
                <label>Venue Location</label>
                <LocationPicker
                  lat={form.lat}
                  lng={form.lng}
                  onChange={(lat, lng) => setForm((f: any) => ({ ...f, lat, lng }))}
                />
              </div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="live">Live</option>
                  <option value="ended">Ended</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer m-0">
                  <input type="checkbox" checked={form.hasVirtual} onChange={e => setForm((f: any) => ({ ...f, hasVirtual: e.target.checked }))} className="w-auto" />
                  <span className="text-gray-300 text-sm">Virtual attendance available</span>
                </label>
                {form.hasVirtual && (
                  <div className="flex items-center gap-2">
                    <label className="m-0 text-sm">Price:</label>
                    <input type="number" value={form.virtualPrice} onChange={e => setForm((f: any) => ({ ...f, virtualPrice: parseFloat(e.target.value) }))} className="w-24" />
                  </div>
                )}
              </div>
            </div>

            {/* Ticket types */}
            {!editing && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="m-0">Ticket Types</label>
                  <button onClick={addTicketType} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <Plus size={12} /> Add Type
                  </button>
                </div>
                {form.ticketTypes.map((t: any, i: number) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                    <input placeholder="Name (e.g. VIP)" value={t.name} onChange={e => updateTicketType(i, 'name', e.target.value)} />
                    <input type="number" placeholder="Price" value={t.price} onChange={e => updateTicketType(i, 'price', parseFloat(e.target.value))} />
                    <input type="number" placeholder="Capacity" value={t.capacity} onChange={e => updateTicketType(i, 'capacity', parseInt(e.target.value))} />
                    <input type="color" value={t.color} onChange={e => updateTicketType(i, 'color', e.target.value)} className="h-10 cursor-pointer p-1" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !form.name || !form.venue || !form.date} className="btn-primary flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editing ? 'Save' : 'Create Event'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Events list */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-gray-500">No events yet. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.id} className="card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white truncate">{ev.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ev.status] ?? ''}`}>
                      {ev.status}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(ev.date, 'MMM d, yyyy')}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} />{ev.venue}</span>
                    <span className="flex items-center gap-1"><Ticket size={11} />{ev._count.tickets} sold</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Status quick-change */}
                  <select
                    value={ev.status}
                    onChange={e => updateStatus(ev.id, e.target.value)}
                    className="text-xs py-1 px-2 w-28"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="live">Live</option>
                    <option value="ended">Ended</option>
                  </select>
                  <button onClick={() => { setEditing(ev.id); setShowForm(true) }} className="text-gray-500 hover:text-blue-400 transition-colors">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => deleteEvent(ev.id)} className="text-gray-500 hover:text-red-400 transition-colors">
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
