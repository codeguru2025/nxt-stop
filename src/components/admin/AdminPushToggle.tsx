'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type State = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on' | 'busy'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js')
}

/** Per-device switch for admin push alerts (failed payments, …). Lives in the admin sidebar. */
export default function AdminPushToggle() {
  const [state, setState] = useState<State>('loading')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        // iPhone/iPad only support web push for sites added to the Home Screen
        if (!cancelled) setState('unsupported')
        return
      }
      try {
        const reg = await getRegistration()
        const sub = await reg.pushManager.getSubscription()
        const qs = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ''
        const res = await fetch(`/api/admin/push${qs}`).then(r => r.json())
        if (cancelled) return
        if (!res.success || !res.data.publicKey) { setState('unconfigured'); return }
        setPublicKey(res.data.publicKey)
        if (Notification.permission === 'denied') setState('denied')
        else setState(sub && res.data.subscribed ? 'on' : 'off')
      } catch {
        if (!cancelled) setState('unsupported')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const enable = async () => {
    if (!publicKey) return
    setState('busy')
    setHint('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return }
      const reg = await getRegistration()
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }))
      const res = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      }).then(r => r.json())
      if (!res.success) throw new Error(res.error)
      setState('on')
    } catch {
      setHint('Could not turn on alerts — try again')
      setState('off')
    }
  }

  const disable = async () => {
    setState('busy')
    try {
      const reg = await getRegistration()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/admin/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
    } finally {
      setState('off')
    }
  }

  if (state === 'loading' || state === 'unconfigured') return null

  const label =
    state === 'on' ? 'Alerts on' :
    state === 'denied' ? 'Alerts blocked' :
    state === 'unsupported' ? 'Alerts unavailable' :
    'Enable alerts'
  const sub =
    state === 'on' ? 'Failed payments notify this device' :
    state === 'denied' ? 'Allow notifications in browser settings' :
    state === 'unsupported' ? 'On iPhone, add this site to your Home Screen first' :
    hint || 'Get notified when a payment fails'

  const Icon = state === 'on' ? BellRing : state === 'denied' || state === 'unsupported' ? BellOff : Bell
  const clickable = state === 'on' || state === 'off'

  return (
    <button
      type="button"
      onClick={state === 'on' ? disable : state === 'off' ? enable : undefined}
      disabled={!clickable}
      title={state === 'on' ? 'Tap to turn alerts off on this device' : undefined}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-1 text-left',
        state === 'on' ? 'text-green-400 hover:bg-green-500/5' :
        clickable ? 'text-purple-300 hover:bg-purple-500/10' :
        'text-gray-600 cursor-default'
      )}
    >
      {state === 'busy' ? <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin" /> : <Icon size={16} className="shrink-0 mt-0.5" />}
      <span className="min-w-0">
        <span className="block font-medium">{state === 'busy' ? 'Working…' : label}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </button>
  )
}
