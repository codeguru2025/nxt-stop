'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'

const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false })
import {
  Plus, Calendar, MapPin, Ticket, Edit, Trash2,
  Loader2, Check, X, ImagePlus, UserPlus, Mic2, Music2,
  QrCode, Download, RefreshCw,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

type LineupArtist = {
  name: string
  role: 'headline' | 'mc' | 'support_dj' | 'special_guest'
  image: string
}

type Event = {
  id: string; name: string; slug: string; date: string; venue: string
  status: string; ticketTypes: any[]; _count: { tickets: number }
  qrCodeUrl?: string | null
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
    { name: 'General', price: 10, capacity: 500, color: '#E8174A' }
  ],
  lineup: [] as LineupArtist[],
}

const ROLE_LABELS: Record<string, string> = {
  headline: 'Headline Act',
  mc: 'MC',
  support_dj: 'Support DJ',
  special_guest: 'Special Guest',
}

export default function AdminEventsClient() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(BLANK_FORM)
  const [editing, setEditing] = useState<string | null>(null)
  const [posterUploading, setPosterUploading] = useState(false)
  const [artistUploading, setArtistUploading] = useState<Record<number, boolean>>({})
  const posterInputRef = useRef<HTMLInputElement>(null)
  const artistInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [qrModal, setQrModal] = useState<{ id: string; name: string; qrCodeUrl: string } | null>(null)
  const [qrRegenerating, setQrRegenerating] = useState<string | null>(null)

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

  const [saveError, setSaveError] = useState('')

  const save = async () => {
    setSaving(true)
    setSaveError('')
    const url = editing ? `/api/admin/events/${editing}` : '/api/admin/events'
    const method = editing ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then(r => r.json())

      if (res.success) { load(); setShowForm(false); setEditing(null); setForm(BLANK_FORM) }
      else setSaveError(res.error ?? 'Failed to save event')
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/admin/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } catch { /* handled silently — load() will show current state */ }
    load()
  }

  const startEdit = async (id: string) => {
    const res = await fetch(`/api/admin/events/${id}`).then(r => r.json())
    if (!res.success) return
    const ev = res.data
    const toLocal = (iso: string | null) => iso ? iso.slice(0, 16) : ''
    let lineup: LineupArtist[] = []
    try { lineup = ev.lineup ? JSON.parse(ev.lineup) : [] } catch {}
    setForm({
      name: ev.name ?? '',
      venue: ev.venue ?? '',
      address: ev.address ?? '',
      date: toLocal(ev.date),
      endDate: toLocal(ev.endDate),
      description: ev.description ?? '',
      posterImage: ev.posterImage ?? '',
      bannerImage: ev.bannerImage ?? '',
      hasVirtual: ev.hasVirtual ?? false,
      virtualPrice: ev.virtualPrice ?? 5,
      status: ev.status ?? 'draft',
      lat: ev.lat != null ? String(ev.lat) : '',
      lng: ev.lng != null ? String(ev.lng) : '',
      ticketTypes: ev.ticketTypes ?? [],
      lineup,
    })
    setEditing(id)
    setShowForm(true)
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' }).then(r => r.json())
      if (!res.success) alert(res.error ?? 'Failed to delete event')
    } catch { alert('Network error') }
    load()
  }

  const uploadPoster = async (file: File) => {
    setPosterUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'events')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd }).then(r => r.json())
      if (res.success) {
        setForm((f: any) => ({ ...f, posterImage: res.data.url }))
      } else {
        alert(res.error ?? 'Upload failed')
      }
    } finally {
      setPosterUploading(false)
    }
  }

  const uploadArtistImage = async (index: number, file: File) => {
    setArtistUploading(prev => ({ ...prev, [index]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'artists')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd }).then(r => r.json())
      if (res.success) {
        setForm((f: any) => ({
          ...f,
          lineup: f.lineup.map((a: LineupArtist, i: number) => i === index ? { ...a, image: res.data.url } : a)
        }))
      } else {
        alert(res.error ?? 'Upload failed')
      }
    } finally {
      setArtistUploading(prev => ({ ...prev, [index]: false }))
    }
  }

  const addArtist = () => {
    setForm((f: any) => ({
      ...f,
      lineup: [...f.lineup, { name: '', role: 'support_dj', image: '' }]
    }))
  }

  const updateArtist = (i: number, key: string, value: string) => {
    setForm((f: any) => ({
      ...f,
      lineup: f.lineup.map((a: LineupArtist, idx: number) => idx === i ? { ...a, [key]: value } : a)
    }))
  }

  const removeArtist = (i: number) => {
    setForm((f: any) => ({
      ...f,
      lineup: f.lineup.filter((_: any, idx: number) => idx !== i)
    }))
  }

  const addTicketType = () => {
    setForm((f: any) => ({
      ...f,
      ticketTypes: [...f.ticketTypes, { name: '', price: 0, capacity: 100, color: '#E8174A' }]
    }))
  }

  const updateTicketType = (i: number, key: string, value: any) => {
    setForm((f: any) => ({
      ...f,
      ticketTypes: f.ticketTypes.map((t: any, idx: number) => idx === i ? { ...t, [key]: value } : t)
    }))
  }

  const regenerateQr = async (id: string) => {
    setQrRegenerating(id)
    try {
      const res = await fetch(`/api/admin/events/${id}/qr`, { method: 'POST' }).then(r => r.json())
      if (res.success) {
        setEvents(evs => evs.map(ev => ev.id === id ? { ...ev, qrCodeUrl: res.data.qrCodeUrl } : ev))
        if (qrModal?.id === id) setQrModal(m => m ? { ...m, qrCodeUrl: res.data.qrCodeUrl } : m)
      } else {
        alert(res.error ?? 'Failed to generate QR code')
      }
    } catch {
      alert('Network error')
    } finally {
      setQrRegenerating(null)
    }
  }

  const downloadQr = async (url: string, name: string) => {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `qr-${name.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const anyUploading = posterUploading || Object.values(artistUploading).some(Boolean)

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
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
                <label>Poster Image</label>
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) uploadPoster(file)
                    e.target.value = ''
                  }}
                />
                {form.posterImage ? (
                  <div className="relative group w-full aspect-video rounded-lg overflow-hidden border border-[#2a2a2a]">
                    <img
                      src={form.posterImage}
                      alt="Poster preview"
                      className="w-full h-full object-cover"
                      onError={() => setForm((f: any) => ({ ...f, posterImage: '' }))}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => posterInputRef.current?.click()}
                        className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-md px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <ImagePlus size={13} /> Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f: any) => ({ ...f, posterImage: '' }))}
                        className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-md px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <X size={13} /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => posterInputRef.current?.click()}
                    disabled={posterUploading}
                    className="w-full aspect-video rounded-lg border-2 border-dashed border-[#2a2a2a] hover:border-purple-500/50 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    {posterUploading ? (
                      <><Loader2 size={22} className="animate-spin" /><span className="text-xs">Uploading…</span></>
                    ) : (
                      <><ImagePlus size={22} /><span className="text-xs">Click to upload poster</span><span className="text-xs opacity-60">JPG, PNG, WebP · max 10 MB</span></>
                    )}
                  </button>
                )}
              </div>
              {editing && (
                <div>
                  <label className="flex items-center gap-1.5"><QrCode size={13} /> QR Code</label>
                  {(() => {
                    const ev = events.find(e => e.id === editing)
                    const qrUrl = ev?.qrCodeUrl
                    return qrUrl ? (
                      <div className="flex items-start gap-3 p-3 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                        <div className="bg-white rounded-lg p-1.5 shrink-0">
                          <img src={qrUrl} alt="QR Code" className="w-20 h-20 object-contain" />
                        </div>
                        <div className="flex flex-col gap-2 justify-center">
                          <p className="text-xs text-gray-400">Share with your graphic designer to print on the poster.</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => downloadQr(qrUrl, form.name)}
                              className="text-xs btn-primary flex items-center gap-1.5"
                            >
                              <Download size={11} /> Download PNG
                            </button>
                            <button
                              type="button"
                              onClick={() => regenerateQr(editing)}
                              disabled={qrRegenerating === editing}
                              className="text-xs text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-2 py-1.5 flex items-center gap-1 transition-colors"
                            >
                              {qrRegenerating === editing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Regenerate
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => regenerateQr(editing)}
                        disabled={qrRegenerating === editing}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-400 border border-dashed border-[#2a2a2a] hover:border-purple-500/40 rounded-xl px-4 py-3 transition-colors w-full justify-center"
                      >
                        {qrRegenerating === editing ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                        Generate QR Code
                      </button>
                    )
                  })()}
                </div>
              )}
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

            {/* Lineup */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <label className="m-0 flex items-center gap-2"><Music2 size={14} /> Lineup</label>
                <button onClick={addArtist} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  <UserPlus size={12} /> Add Artist
                </button>
              </div>
              {form.lineup.length === 0 && (
                <p className="text-xs text-gray-600 mb-2">No artists added yet. Add an MC and headline act to show them on the home screen.</p>
              )}
              {form.lineup.map((artist: LineupArtist, i: number) => (
                <div key={i} className="flex gap-3 mb-3 p-3 bg-[#111] rounded-xl border border-[#2a2a2a] items-start">
                  {/* Artist image upload */}
                  <div className="shrink-0">
                    <input
                      ref={el => { artistInputRefs.current[i] = el }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) uploadArtistImage(i, file)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => artistInputRefs.current[i]?.click()}
                      disabled={artistUploading[i]}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-[#3a3a3a] hover:border-purple-500/50 overflow-hidden flex items-center justify-center transition-colors"
                    >
                      {artistUploading[i] ? (
                        <Loader2 size={16} className="animate-spin text-purple-400" />
                      ) : artist.image ? (
                        <img src={artist.image} alt="" className="w-full h-full object-cover" onError={() => updateArtist(i, 'image', '')} />
                      ) : (
                        <Mic2 size={18} className="text-gray-600" />
                      )}
                    </button>
                  </div>

                  {/* Artist name + role */}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      placeholder="Artist name"
                      value={artist.name}
                      onChange={e => updateArtist(i, 'name', e.target.value)}
                    />
                    <select value={artist.role} onChange={e => updateArtist(i, 'role', e.target.value)}>
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <button type="button" onClick={() => removeArtist(i)} className="text-gray-600 hover:text-red-400 transition-colors mt-1 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Ticket types */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <label className="m-0">Ticket Types</label>
                <button onClick={addTicketType} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  <Plus size={12} /> Add Type
                </button>
              </div>
              {form.ticketTypes.map((t: any, i: number) => (
                <div key={t.id ?? `new-${i}`} className="mb-2">
                  <div className="grid grid-cols-4 gap-2">
                    <input placeholder="Name (e.g. VIP)" value={t.name} onChange={e => updateTicketType(i, 'name', e.target.value)} />
                    <input type="number" placeholder="Price" value={t.price} onChange={e => updateTicketType(i, 'price', parseFloat(e.target.value))} />
                    <input type="number" placeholder="Capacity" value={t.capacity} onChange={e => updateTicketType(i, 'capacity', parseInt(e.target.value))} />
                    <div className="flex items-center gap-1.5">
                      <input type="color" value={t.color} onChange={e => updateTicketType(i, 'color', e.target.value)} className="h-10 cursor-pointer p-1 flex-1" />
                      {!t.id && (
                        <button
                          type="button"
                          onClick={() => setForm((f: any) => ({ ...f, ticketTypes: f.ticketTypes.filter((_: any, idx: number) => idx !== i) }))}
                          className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {editing && t.id && typeof t.sold === 'number' && (
                    <p className="text-xs text-gray-600 mt-0.5 ml-0.5">{t.sold} sold of {t.capacity}</p>
                  )}
                </div>
              ))}
            </div>

            {saveError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{saveError}</div>
            )}

            <div className="flex gap-2">
              <button onClick={save} disabled={saving || anyUploading || !form.name || !form.venue || !form.date} className="btn-primary flex items-center gap-2 text-sm">
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
                    <span className="flex items-center gap-1"><Ticket size={11} />{ev.ticketTypes.reduce((s: number, t: any) => s + t.sold, 0)} sold</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                  {ev.qrCodeUrl ? (
                    <button
                      onClick={() => setQrModal({ id: ev.id, name: ev.name, qrCodeUrl: ev.qrCodeUrl! })}
                      className="text-gray-500 hover:text-purple-400 transition-colors"
                      title="View QR code"
                    >
                      <QrCode size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => regenerateQr(ev.id)}
                      disabled={qrRegenerating === ev.id}
                      className="text-gray-600 hover:text-purple-400 transition-colors"
                      title="Generate QR code"
                    >
                      {qrRegenerating === ev.id ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                    </button>
                  )}
                  <button onClick={() => startEdit(ev.id)} className="text-gray-500 hover:text-blue-400 transition-colors">
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
        {/* QR Code Modal */}
        {qrModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setQrModal(null)}>
            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-sm">Event QR Code</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{qrModal.name}</p>
                </div>
                <button onClick={() => setQrModal(null)} className="text-gray-600 hover:text-white transition-colors"><X size={16} /></button>
              </div>
              <div className="bg-white rounded-xl p-3 mb-4">
                <img src={qrModal.qrCodeUrl} alt="QR Code" className="w-full aspect-square object-contain" />
              </div>
              <p className="text-xs text-gray-500 text-center mb-4">Scan to go straight to ticket purchase</p>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadQr(qrModal.qrCodeUrl, qrModal.name)}
                  className="flex-1 btn-primary text-sm flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Download PNG
                </button>
                <button
                  onClick={() => regenerateQr(qrModal.id)}
                  disabled={qrRegenerating === qrModal.id}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2 transition-colors"
                  title="Regenerate"
                >
                  {qrRegenerating === qrModal.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
    </AdminLayout>
  )
}
