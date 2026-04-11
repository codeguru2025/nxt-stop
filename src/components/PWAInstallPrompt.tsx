'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Already installed — don't show
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Already dismissed this session
    if (sessionStorage.getItem('pwa-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  const dismiss = () => {
    sessionStorage.setItem('pwa-dismissed', '1')
    setDismissed(true)
  }

  if (!prompt || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-[#1a1a1a] border border-purple-500/30 rounded-2xl p-4 shadow-2xl shadow-black/50 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center shrink-0">
        <Download size={18} className="text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">Install App</p>
        <p className="text-gray-500 text-xs truncate">Get the full NXT STOP experience</p>
      </div>
      <button
        onClick={install}
        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        Install
      </button>
      <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 transition-colors shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
