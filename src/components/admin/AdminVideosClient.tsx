'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, Trash2, Loader2, Video, ExternalLink, Upload } from 'lucide-react'

type Teaser = {
  id: string
  eventId: string
  url: string
  youtubeUrl: string | null
  caption: string | null
  event: { name: string; date: string; slug: string }
}

type EventOption = { id: string; name: string }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminVideosClient() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [teasers, setTeasers] = useState<Teaser[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ eventId: '', youtubeUrl: '', caption: '' })
  /** File chosen from device — kept in state so selection is visible and upload is reliable on mobile */
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const load = () => {
    fetch('/api/media/teasers')
      .then(r => r.json())
      .then(d => {
        if (d.success) setTeasers(d.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.success || d.data.role !== 'admin') {
          router.push('/login')
          return
        }
        fetch('/api/admin/events')
          .then(r => r.json())
          .then(ev => {
            if (ev.success) setEvents(ev.data.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })))
          })
        load()
      })
  }, [router])

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(pendingFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingFile])

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setUploadError(null)
    setPendingFile(file)
    e.target.value = ''
  }

  const upload = async () => {
    if (!pendingFile) {
      setUploadError('Choose a teaser video file from your device.')
      return
    }
    if (!form.eventId) {
      setUploadError('Select which event this teaser is for.')
      return
    }

    setUploading(true)
    setUploadError(null)

    const fd = new FormData()
    fd.append('file', pendingFile)
    fd.append('type', 'teaser')
    if (form.youtubeUrl.trim()) fd.append('youtubeUrl', form.youtubeUrl.trim())
    if (form.caption.trim()) fd.append('caption', form.caption.trim())

    try {
      const res = await fetch(`/api/admin/events/${form.eventId}/media`, { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        message?: string
      }

      if (!res.ok || data.success !== true) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : typeof data.message === 'string'
              ? data.message
              : res.status === 403
                ? 'Session or security check failed. Refresh the page and try again.'
                : `Upload failed (${res.status}). Try a smaller file or MP4/MOV format.`
        setUploadError(msg)
        return
      }

      setForm({ eventId: '', youtubeUrl: '', caption: '' })
      setPendingFile(null)
      load()
    } catch {
      setUploadError('Network error — check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (teaser: Teaser) => {
    if (!confirm('Delete this video?')) return
    const res = await fetch(`/api/admin/events/${teaser.eventId}/media`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId: teaser.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      alert(typeof data.error === 'string' ? data.error : 'Could not delete video')
      return
    }
    load()
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Past Event Videos</h1>
            <p className="text-gray-500 text-sm mt-0.5">Upload teaser clips linked to full YouTube videos</p>
          </div>
        </div>

        {/* Upload */}
        <div className="card p-5 mb-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Video size={16} /> Add Video Teaser
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label>Event *</label>
              <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                <option value="">Select event...</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
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
            <div className="sm:col-span-2">
              <label>Teaser Video File *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.m4v,.webm,.3gp,video/mp4,video/quicktime"
                className="sr-only"
                onChange={onFileChosen}
              />
              <div className="mt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 text-sm text-gray-300 hover:text-white border border-dashed border-[#2a2a2a] hover:border-purple-500/50 rounded-xl px-4 py-3 transition-all w-full sm:w-auto sm:inline-flex"
                >
                  <Upload size={16} className="text-purple-400 shrink-0" />
                  {pendingFile ? 'Choose a different video' : 'Choose video from gallery / files'}
                </button>
                {pendingFile && (
                  <div className="rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] px-3 py-2 text-sm">
                    <p className="text-white font-medium truncate" title={pendingFile.name}>
                      {pendingFile.name || 'Video selected'}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{formatBytes(pendingFile.size)}</p>
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      className="text-xs text-red-400 hover:text-red-300 mt-2"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
                {previewUrl && (
                  <video src={previewUrl} className="w-full max-w-md rounded-lg border border-[#2a2a2a] bg-black mt-1" controls muted playsInline />
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label>Caption</label>
              <input
                value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="e.g. Dlala Thukzin Live Highlights"
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-sm text-red-400 mb-3" role="alert">
              {uploadError}
            </p>
          )}

          {!form.eventId && pendingFile && (
            <p className="text-sm text-amber-400/90 mb-3">Select an event above, then click &quot;Upload Teaser&quot; to save.</p>
          )}

          <button
            onClick={upload}
            disabled={uploading || !form.eventId || !pendingFile}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
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
                <video
                  src={t.url}
                  className="w-full aspect-video object-cover bg-black"
                  muted
                  loop
                  playsInline
                  onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={e => {
                    const v = e.target as HTMLVideoElement
                    v.pause()
                    v.currentTime = 0
                  }}
                />
                <div className="p-3">
                  <p className="text-white text-sm font-medium truncate">{t.event.name}</p>
                  {t.caption && <p className="text-gray-500 text-xs truncate">{t.caption}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    {t.youtubeUrl && (
                      <a
                        href={t.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                      >
                        <ExternalLink size={11} /> YouTube
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(t)}
                      className="ml-auto text-gray-600 hover:text-red-400 transition-colors"
                    >
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
