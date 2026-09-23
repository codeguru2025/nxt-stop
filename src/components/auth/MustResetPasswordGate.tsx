'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// UX-layer gate, not the security boundary — the actual single-use enforcement is
// that only POST /api/auth/set-password can ever clear User.mustResetPassword.
// This just redirects a logged-in user off every other page until they've done so.
const EXEMPT_PATHS = ['/set-password', '/login', '/forgot-password', '/reset-password']

export default function MustResetPasswordGate() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res.data?.mustResetPassword) {
          router.push('/set-password')
        }
      })
      .catch(() => {})
  }, [pathname, router])

  return null
}
