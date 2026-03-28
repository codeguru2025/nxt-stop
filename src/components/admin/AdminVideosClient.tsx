'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, Trash2, Loader2, Video, ExternalLink } from 'lucide-react'

type Teaser = {
  id: string
  url: string
  youtubeUrl: string | null
  caption: string | null
  event: { name: string; date: string; slug: string }
}

type EventOption = { id: string; name: string }

export default function AdminVideosClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [teasers, setTeasers] = useState<Teaser[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ eventId: '', youtubeUrl: '', caption: '' })

  const load = () => {
    fetch('/api/media/teasers').then(r => r.json()).then(d => {
      if (d.success) setTeasers(d.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || d.data.role !== 'admin') { router.push('/login'); return }
      fetch('/api/admin/events').then(r => r.json()).then(d => {
        if (d.success) setEvents(d.data.map((e: any) => ({ id: e.id, name: e.name })))
      })
      load()
    })
  }, [router])

  const upload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !form.eventId) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', 'teaser')
    if (form.youtubeUrl) fd.append('youtubeUrl', form.youtubeUrl)
    if (form.caption) fd.append('caption', form.caption)
    await fetch(`/api/admin/events/${form.eventId}/media`, { method: 'POST', body: fd })
    setForm({ eventId: '', youtubeUrl: '', caption: '' })
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
    load()
  }

  const remove = async (teaser: Teaser) => {
    if (!confirm('Delete this video?')) return
    await fetch(`/api/admin/events/${(teaser as any).eventId}/media`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: teaser.id }),
    })
    load()
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Past Event Videos</h1>
            <p className="text-gray-500 text-sm mt-0.5">Upload teaser clips linked to full YouTube videos</p>
          </div>
        </div>

        {/* Upload */}
        <div className="card p-5 mb-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Video size={16} /> Add Video Teaser</h3>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label>Event *</label>
              <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                <option value="">Select event...</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <div>
              <label>YouTube Full Video URL</label>
              <input
                value={form.youtubeUrl}
                onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div>
              <label>Teaser Video File *</label>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 cursor-pointer"
              />
            </div>
            <div>
              <label>Caption</label>
              <input
                value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="e.g. Dlala Thukzin Live Highlights"
              />
            </div>
          </div>
          <button onClick={upload} disabled={uploading || !form.eventId} className="btn-primary flex items-center gap-2 text-sm">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {uploading ? 'Uploading...' : 'Upload Teaser'}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        ) : teasers.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🎬</div>
            <p className="text-gray-500">No videos yet. Upload one above.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teasers.map(t => (
              <div key={t.id} className="card overflow-hidden">
                <video src={t.url} className="w-full aspect-video object-cover bg-black" muted loop playsInline
                  onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={e => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
                />
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{t.event.name}</p>
                  {t.caption && <p className="text-gray-500 text-xs truncate">{t.caption}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    {t.youtubeUrl && (
                      <a href={t.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                        <ExternalLink size={11} /> YouTube
                      </a>
                    )}
                    <button onClick={() => remove(t)} className="ml-auto text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
