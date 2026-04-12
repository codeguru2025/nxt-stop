'use client'

import { useState } from 'react'

export type GalleryPhoto = { id: string; url: string; caption: string | null }

type Props = { initialPhotos: GalleryPhoto[] }

export default function GalleryClient({ initialPhotos }: Props) {
  const [selected, setSelected] = useState<GalleryPhoto | null>(null)
  const photos = initialPhotos

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-20 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white mb-2">Gallery</h1>
          <p className="text-gray-500">Moments from our events</p>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-gray-500 text-lg">No photos yet — check back after the next event.</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {photos.map(photo => (
              <div
                key={photo.id}
                className="break-inside-avoid cursor-pointer group relative rounded-xl overflow-hidden"
                onClick={() => setSelected(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? ''}
                  loading="lazy"
                  decoding="async"
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
            <img src={selected.url} alt={selected.caption ?? ''} className="w-full max-h-[85vh] object-contain rounded-xl" />
            {selected.caption && (
              <p className="text-gray-300 text-sm text-center mt-3">{selected.caption}</p>
            )}
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#222] border border-[#333] text-gray-400 hover:text-white flex items-center justify-center text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
