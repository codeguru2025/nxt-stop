'use client'

import { useEffect, useState } from 'react'

type Founder = {
  id: string; name: string; role?: string; bio?: string
  image?: string; order: number; active: boolean
}

export default function AboutClient() {
  const [founders, setFounders] = useState<Founder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/founders')
      .then(r => r.json())
      .then(d => { if (d.success) setFounders(d.data) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-[#0a0a0a] to-pink-900/10" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-purple-300 text-sm">The Vision Behind The Movement</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-6">
            Built By People Who<br />
            <span className="gradient-text">Live The Culture</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            NXT STOP was built by event lovers, for event lovers. We combined deep knowledge of Zimbabwe's nightlife scene with world-class technology to create the platform this culture deserved.
          </p>
        </div>
      </section>

      {/* Featured DJs */}
      <section className="py-16 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-white mb-2">The DJs</h2>
            <p className="text-gray-500">The talent behind the NXT STOP sound</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                name: 'Big Q',
                role: 'Resident DJ',
                image: 'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q.jpeg',
                gallery: [
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q%202.jpeg',
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q%203.jpeg',
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Big%20Q%206.jpeg',
                ],
              },
              {
                name: 'Corrason',
                role: 'Resident DJ',
                image: 'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason.jpeg',
                gallery: [
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason%202.jpeg',
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason%203.jpeg',
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Corrason%205.jpeg',
                ],
              },
              {
                name: 'Yugo',
                role: 'Resident DJ',
                image: 'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Yugo.jpeg',
                gallery: [
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Yugo%202.jpeg',
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Yugo%203.jpeg',
                  'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/Yugo%204.jpeg',
                ],
              },
            ].map(dj => (
              <div key={dj.name} className="group">
                <div className="relative overflow-hidden rounded-2xl mb-4 aspect-[3/4]">
                  <img
                    src={dj.image}
                    alt={dj.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-2xl font-black text-white">{dj.name}</h3>
                    <p className="text-purple-400 text-sm font-medium">{dj.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {dj.gallery.map((img, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden">
                      <img src={img} alt={`${dj.name} ${i + 2}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founders — managed via admin */}
      {founders.length > 0 && (
        <section className="py-16 border-t border-[#1a1a1a]">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-black text-white mb-2">The Team</h2>
              <p className="text-gray-500">The people building NXT STOP</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {founders.map(f => (
                <div key={f.id} className="card p-6 text-center hover:border-[#3a3a3a] hover:-translate-y-1 transition-all group">
                  <div className="mb-5">
                    {f.image ? (
                      <img src={f.image} alt={f.name} className="w-24 h-24 rounded-2xl object-cover border-2 border-purple-500/20 mx-auto group-hover:border-purple-500/50 transition-all" />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mx-auto">
                        <span className="text-white font-black text-4xl">{f.name[0]}</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-white mb-1">{f.name}</h3>
                  {f.role && <p className="text-purple-400 text-sm font-medium mb-3">{f.role}</p>}
                  {f.bio && <p className="text-gray-500 text-sm leading-relaxed">{f.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Mission */}
      <section className="py-16 border-t border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'The Mission', desc: "To elevate Zimbabwe's event industry with technology that delivers security, scale, and premium experiences for every attendee." },
              { title: 'The Vision', desc: 'To become the infrastructure layer for premium nightlife events across Southern Africa — starting in Harare, scaling everywhere.' },
              { title: 'The Standard', desc: "Every feature built on this platform is held to one standard: would this feel world-class? If not, it doesn't ship." },
            ].map(s => (
              <div key={s.title} className="stat-card">
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
