'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Check, X, AlertTriangle, Loader2, User, Ticket, RefreshCw } from 'lucide-react'

type ScanResult = {
  result: 'valid' | 'already_used' | 'invalid'
  message: string
  ticket?: {
    number: string
    holder: string
    email?: string
    type: string
    event: string
  }
  usedAt?: string
}

type Stats = { scanned: number; valid: number; invalid: number }

export default function GateClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [qrInput, setQrInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [stats, setStats] = useState<Stats>({ scanned: 0, valid: 0, invalid: 0 })
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || !['admin', 'gate_staff'].includes(d.data?.role)) {
        router.push('/login')
      } else {
        setAuthed(true)
      }
    }).finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (authed) inputRef.current?.focus()
  }, [authed])

  // Auto-scan when QR code pasted (length threshold for UUID)
  useEffect(() => {
    if (qrInput.length >= 36) {
      handleScan(qrInput)
    }
  }, [qrInput])

  const handleScan = async (code: string) => {
    if (!code.trim() || scanning) return
    setScanning(true)
    setResult(null)

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrCode: code.trim() }),
    }).then(r => r.json())

    setScanning(false)
    setQrInput('')
    inputRef.current?.focus()

    if (res.success) {
      const data = res.data as ScanResult
      setResult(data)
      setStats(prev => ({
        scanned: prev.scanned + 1,
        valid: prev.valid + (data.result === 'valid' ? 1 : 0),
        invalid: prev.invalid + (data.result !== 'valid' ? 1 : 0),
      }))

      // Auto-clear after 4 seconds
      setTimeout(() => setResult(null), 4000)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-purple-500" />
    </div>
  )

  if (!authed) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
            <span className="text-white font-black text-sm">N</span>
          </div>
          <div>
            <div className="font-bold text-white text-sm">NXT STOP Gate</div>
            <div className="text-xs text-gray-500">Entry Validation System</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="font-black text-white">{stats.scanned}</div>
            <div className="text-xs text-gray-500">Scanned</div>
          </div>
          <div className="text-center">
            <div className="font-black text-green-400">{stats.valid}</div>
            <div className="text-xs text-gray-500">Valid</div>
          </div>
          <div className="text-center">
            <div className="font-black text-red-400">{stats.invalid}</div>
            <div className="text-xs text-gray-500">Rejected</div>
          </div>
        </div>
      </div>

      {/* Main scanner */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        {/* Result display */}
        {result ? (
          <div className={`w-full max-w-sm border rounded-2xl p-6 text-center transition-all ${
            result.result === 'valid' ? 'scan-valid bg-green-500/5' :
            result.result === 'already_used' ? 'scan-used bg-yellow-500/5' :
            'scan-invalid bg-red-500/5'
          } card`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              result.result === 'valid' ? 'bg-green-500/20' :
              result.result === 'already_used' ? 'bg-yellow-500/20' :
              'bg-red-500/20'
            }`}>
              {result.result === 'valid' ? (
                <Check size={40} className="text-green-400" />
              ) : result.result === 'already_used' ? (
                <AlertTriangle size={40} className="text-yellow-400" />
              ) : (
                <X size={40} className="text-red-400" />
              )}
            </div>

            <h2 className={`text-2xl font-black mb-1 ${
              result.result === 'valid' ? 'text-green-400' :
              result.result === 'already_used' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {result.result === 'valid' ? 'ENTRY GRANTED' :
               result.result === 'already_used' ? 'ALREADY USED' :
               'INVALID TICKET'}
            </h2>

            <p className="text-gray-400 text-sm mb-4">{result.message}</p>

            {result.ticket && (
              <div className="bg-[#111] rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-gray-500" />
                  <span className="text-white font-medium">{result.ticket.holder}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Ticket size={14} className="text-gray-500" />
                  <span className="text-gray-300">{result.ticket.type}</span>
                </div>
                <div className="text-xs text-gray-600 font-mono">{result.ticket.number}</div>
                {result.usedAt && (
                  <div className="text-xs text-yellow-500">
                    Used at: {new Date(result.usedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className={`w-32 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center mx-auto mb-6 ${
              scanning ? 'border-purple-500 bg-purple-500/10' : 'border-[#3a3a3a]'
            }`}>
              {scanning ? (
                <Loader2 size={40} className="text-purple-400 animate-spin" />
              ) : (
                <QrCode size={48} className="text-gray-600" />
              )}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ready to Scan</h2>
            <p className="text-gray-500 text-sm">Scan or paste a QR code to validate entry</p>
          </div>
        )}

        {/* Input */}
        <div className="w-full max-w-sm">
          <input
            ref={inputRef}
            value={qrInput}
            onChange={e => setQrInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan(qrInput)}
            placeholder="Scan QR code or paste ticket ID..."
            className="text-center font-mono text-sm"
            autoFocus
            autoComplete="off"
          />
          <button
            onClick={() => handleScan(qrInput)}
            disabled={!qrInput || scanning}
            className="w-full btn-primary mt-2 flex items-center justify-center gap-2"
          >
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
            {scanning ? 'Validating...' : 'Validate Ticket'}
          </button>
          <button
            onClick={() => { setQrInput(''); setResult(null); inputRef.current?.focus() }}
            className="w-full mt-2 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw size={12} />
            Clear & Reset
          </button>
        </div>

        <p className="text-xs text-gray-700 text-center max-w-xs">
          Gate scanner auto-validates on paste or scan. Press Enter to manually confirm.
          All scans are logged in real-time.
        </p>
      </div>
    </div>
  )
}
