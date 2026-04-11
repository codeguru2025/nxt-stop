const CACHE_NAME = 'nxt-stop-v1'
const STATIC_ASSETS = ['/', '/events', '/gallery', '/merch']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Skip non-GET and API/auth requests
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return

  // Network-first for HTML pages, cache-first for static assets
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request))
    )
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
        return res
      }))
    )
  }
})
