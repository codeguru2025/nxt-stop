'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Sends one page view per navigation to /api/track (see lib/visits.ts). The first view
// carries document.referrer so we can tell WhatsApp/Facebook/Google traffic apart.
export default function PageTracker() {
  const pathname = usePathname()
  const first = useRef(true)

  useEffect(() => {
    const body = JSON.stringify({
      path: window.location.pathname + window.location.search,
      referrer: first.current ? document.referrer : null,
    })
    first.current = false
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  }, [pathname])

  return null
}
