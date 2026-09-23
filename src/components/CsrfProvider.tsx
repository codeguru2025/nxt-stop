'use client'

import { useEffect } from 'react'

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/)
  return match?.[1] ?? ''
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

export default function CsrfProvider() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()

      if (!SAFE_METHODS.includes(method)) {
        const token = getCsrfToken()
        if (token) {
          const headers = new Headers(init?.headers)
          if (!headers.has('x-csrf-token')) {
            headers.set('x-csrf-token', token)
          }
          init = { ...init, headers }
        }
      }

      const res = await originalFetch(input, init)
      // A serious admin change was held for a second admin's approval (lib/approvals.ts) —
      // tell AdminLayout so it can show one consistent notice whatever screen sent it.
      if (res.headers.get('x-approval-pending')) {
        res.clone().json()
          .then((d: { error?: string }) => window.dispatchEvent(new CustomEvent('nxt:approval-pending', { detail: d?.error ?? 'Sent for approval' })))
          .catch(() => {})
      }
      return res
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
