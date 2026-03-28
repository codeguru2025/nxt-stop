'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminLayout from './AdminLayout'
import { Plus, Trash2, Loader2, ImageIcon, Eye, EyeOff } from 'lucide-react'

type Photo = { id: string; url: string; caption: string | null; order: number; active: boolean }

export default function AdminGalleryClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')

  const load = () => {
    fetch('/api/admin/gallery').then(r => r.json()).then(d => {
      if (d.success) setPhotos(d.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || d.data.role !== 'admin') { router.push('/login'); return }
      load()
    })
  }, [router])

  const upload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    if (caption) fd.append('caption', caption)
    await fetch('/api/admin/gallery', { method: 'POST', body: fd })
    setCaption('')
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
    load()
  }

  const toggle = async (photo: Photo) => {
    await fetch(`/api/admin/gallery/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !photo.active }),
    })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this photo?')) return
    await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Gallery</h1>
            <p className="text-gray-500 text-sm mt-0.5">{photos.length} photos</p>
          </div>
        </div>

        {/* Upload */}
        <div className="card p-5 mb-6">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ImageIcon size={16} /> Upload Photo</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="flex-1 text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 cursor-pointer"
            />
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="flex-1"
            />
            <button onClick={upload} disabled={uploading} className="btn-primary flex items-center gap-2 text-sm shrink-0">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Upload
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton aspect-square rounded-xl" />)}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🖼️</div>
            <p className="text-gray-500">No photos yet. Upload one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className={`relative group rounded-xl overflow-hidden aspect-square ${!photo.active ? 'opacity-40' : ''}`}>
                <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-full object-cover" />
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5 text-xs text-white truncate">
                    {photo.caption}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => toggle(photo)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">
                    {photo.active ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => remove(photo.id)} className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all">
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
