'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'

export type TeaserItem = {
  id: string
  url: string
  youtubeUrl: string | null
  caption: string | null
  event: { name: string; date: string; slug: string }
}

type Props = { mode: 'home' | 'page'; initialTeasers?: TeaserItem[] }

export default function PastVideosClient({ mode, initialTeasers }: Props) {
  const [teasers, setTeasers] = useState<TeaserItem[]>(initialTeasers ?? [])
  const [loading, setLoading] = useState(initialTeasers === undefined)

  useEffect(() => {
    if (initialTeasers !== undefined) return
    fetch('/api/media/teasers')
      .then(r => r.json())
      .then(d => {
        if (d.success) setTeasers(d.data)
      })
      .finally(() => setLoading(false))
  }, [initialTeasers])

  const grid = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {teasers.map(t => (
        <a
          key={t.id}
          href={t.youtubeUrl ?? '#'}
          target={t.youtubeUrl ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="group relative rounded-2xl overflow-hidden bg-[#111] border border-[#2a2a2a] hover:border-purple-500/40 transition-all"
        >
          <div className="relative aspect-video bg-black overflow-hidden">
            <video
              src={t.url}
              className="w-full h-full object-cover"
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
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play size={20} className="text-white ml-1" fill="white" />
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-white font-semibold truncate group-hover:text-purple-300 transition-colors">{t.event?.name}</p>
            {t.caption && <p className="text-gray-500 text-sm truncate mt-0.5">{t.caption}</p>}
            {t.youtubeUrl && (
              <p className="text-purple-400 text-xs mt-2 flex items-center gap-1">
                <Play size={10} fill="currentColor" /> Watch full video on YouTube
              </p>
            )}
          </div>
        </a>
      ))}
    </div>
  )

  if (mode === 'home') {
    if (loading) return null
    if (teasers.length === 0) return null
    return (
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <p className="text-purple-400 text-sm font-medium uppercase tracking-widest mb-2">Relive The Night</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white">Past Events</h2>
            </div>
            <Link
              href="/videos"
              className="text-purple-400 hover:text-purple-300 text-sm font-medium shrink-0"
            >
              View all →
            </Link>
          </div>
          {grid}
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-20 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <p className="text-purple-400 text-sm font-medium uppercase tracking-widest mb-2">Relive The Night</p>
          <h1 className="text-4xl font-black text-white mb-2">Past Event Videos</h1>
          <p className="text-gray-500">Teasers from previous NXT STOP nights — tap through to the full set on YouTube.</p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-[#2a2a2a] bg-[#111]">
                <div className="skeleton aspect-video w-full" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-4 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : teasers.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-[#2a2a2a] bg-[#111]/50">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-xl font-bold text-white mb-2">No videos yet</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Clips uploaded in Admin → Past Event Videos will show up here for everyone.
            </p>
          </div>
        ) : (
          grid
        )}
      </div>
    </div>
  )
}
