import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',   value: 'on' },
  { key: 'X-Frame-Options',          value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',   value: 'nosniff' },
  { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js inline scripts + Turbopack HMR
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: inline (Next.js injects them) + unpkg for Leaflet
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      // Images: self + any HTTPS (event posters from external CDNs) + data URIs (QR codes)
      "img-src 'self' https: data: blob:",
      // Fonts
      "font-src 'self'",
      // Connects: self + Paynow + OpenStreetMap tiles
      "connect-src 'self' https://www.paynow.co.zw https://*.tile.openstreetmap.org",
      // Leaflet marker icons from unpkg
      "worker-src blob:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
