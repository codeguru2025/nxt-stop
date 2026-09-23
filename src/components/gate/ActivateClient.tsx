'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, Check, X, Loader2, ArrowLeft, DollarSign, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type TicketPreview = {
  ticketNumber: string
  status: string
  event: string
  venue: string
  date: string
  type: string
  color: string
  price: number
  alreadyActivated: boolean
  salesClosed: string | null
}

type ActivationResult = {
  orderNumber: string
  buyer: {
    name: string
    phone: string
    accountCreated: boolean
    passwordEmailed: boolean
  }
  ticket: {
    number: string
    event: string
    venue: string
    date: string
    type: string
    color: string
    price: number
  }
}

export default function ActivateClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<TicketPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [result, setResult] = useState<ActivationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const buyerReady = buyerName.trim() !== '' && buyerPhone.trim() !== ''

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

  const lookupCode = async (val: string) => {
    const clean = val.trim().toUpperCase()
    if (clean.length < 6) return
    setPreviewing(true)
    setPreview(null)
    setPreviewError(null)
    setError(null)
    try {
      const res = await fetch(`/api/activate?code=${encodeURIComponent(clean)}`).then(r => r.json())
      if (res.success) {
        setPreview(res.data)
      } else {
        setPreviewError(res.error ?? 'Code not found')
      }
    } catch {
      setPreviewError('Network error — check connection')
    } finally {
      setPreviewing(false)
    }
  }

  // Auto-lookup when 6 chars entered
  useEffect(() => {
    if (code.trim().length === 6) lookupCode(code)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const confirmActivation = async () => {
    if (!preview || preview.alreadyActivated || preview.salesClosed || !buyerReady) return
    setActivating(true)
    setError(null)
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activationCode: code.trim().toUpperCase(),
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          buyerEmail: buyerEmail.trim() || undefined,
        }),
      }).then(r => r.json())
      if (res.success) {
        setResult(res.data)
        setPreview(null)
        setCode('')
        setBuyerName('')
        setBuyerPhone('')
        setBuyerEmail('')
      } else {
        setError(res.error ?? 'Activation failed')
      }
    } catch {
      setError('Network error — check connection')
    } finally {
      setActivating(false)
    }
  }

  const reset = () => {
    setCode('')
    setPreview(null)
    setPreviewError(null)
    setResult(null)
    setError(null)
    setBuyerName('')
    setBuyerPhone('')
    setBuyerEmail('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-purple-500" />
    </div>
  )
  if (!authed) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">

      {/* Header */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-4 h-14 flex items-center gap-4 shrink-0">
        <Link href="/gate" className="text-gray-500 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="h-4 w-px bg-[#2a2a2a]" />
        <img
          src="https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20png.png"
          alt="NXT STOP"
          className="h-7 w-auto object-contain invert"
        />
        <div className="h-4 w-px bg-[#2a2a2a]" />
        <div>
          <div className="font-bold text-white text-sm leading-none">Sell Ticket</div>
          <div className="text-xs text-gray-500 leading-none mt-0.5">Cash sale — physical ticket</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

        {/* Success */}
        {result ? (
          <div className="w-full max-w-sm">
            <div className="card border-green-500/30 bg-green-500/5 p-6 text-center rounded-2xl">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check size={40} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-black text-green-400 mb-1">TICKET SOLD</h2>
              <p className="text-gray-400 text-sm mb-5">Ticket activated and sale recorded</p>
              <div className="bg-[#111] rounded-xl p-4 text-left space-y-2 mb-5">
                <div className="flex items-center gap-2 text-sm">
                  <Ticket size={14} className="text-gray-500" />
                  <span className="text-white font-mono font-bold">{result.ticket.number}</span>
                </div>
                <div className="text-sm text-gray-300">{result.ticket.type} · {result.ticket.event}</div>
                <div className="text-lg font-black text-purple-400">{formatCurrency(result.ticket.price)}</div>
                <div className="text-xs text-gray-600">Order {result.orderNumber}</div>
              </div>
              <div className="bg-[#111] rounded-xl p-4 text-left space-y-1 mb-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider">Buyer</div>
                <div className="text-sm text-white font-semibold">{result.buyer.name}</div>
                <div className="text-xs text-gray-400 font-mono">{result.buyer.phone}</div>
                <div className="text-xs text-gray-400 pt-1">
                  {!result.buyer.accountCreated
                    ? 'Added to their existing NXT STOP account.'
                    : result.buyer.passwordEmailed
                      ? 'New account created — their password has been emailed to them.'
                      : 'New account created. No email given — to sign in later they tap "Forgot password" and request admin help with this phone number.'}
                </div>
              </div>
              <button onClick={reset} className="w-full btn-primary flex items-center justify-center gap-2">
                <DollarSign size={16} /> Sell Another
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Idle state */}
            {!preview && !previewError && (
              <div className="text-center">
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-[#3a3a3a] flex items-center justify-center mx-auto mb-4">
                  <DollarSign size={48} className="text-gray-600" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Activate Physical Ticket</h2>
                <p className="text-gray-500 text-sm max-w-xs">Enter the 6-character activation code from the ticket stub to record a cash sale</p>
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div className={`w-full max-w-sm card rounded-2xl p-5 ${preview.alreadyActivated ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-purple-500/30 bg-purple-500/5'}`}>
                {preview.alreadyActivated ? (
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle size={20} className="text-yellow-400" />
                    <span className="text-yellow-400 font-bold">Already Activated</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: preview.color }} />
                    <span className="text-white font-bold">{preview.type}</span>
                  </div>
                )}
                <p className="text-white font-semibold">{preview.event}</p>
                <p className="text-gray-400 text-sm">{preview.venue}</p>
                <p className="text-xs text-gray-600 font-mono mt-1">{preview.ticketNumber}</p>
                <p className="text-2xl font-black text-purple-400 mt-3">{formatCurrency(preview.price)}</p>

                {!preview.alreadyActivated && preview.salesClosed && (
                  <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>Can&apos;t sell this ticket: {preview.salesClosed}</span>
                  </div>
                )}

                {!preview.alreadyActivated && !preview.salesClosed && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Buyer details</p>
                    <input
                      type="text"
                      placeholder="Buyer's full name *"
                      value={buyerName}
                      onChange={e => setBuyerName(e.target.value)}
                      className="w-full"
                      autoComplete="off"
                    />
                    <input
                      type="tel"
                      placeholder="Phone number * (e.g. 0771234567)"
                      value={buyerPhone}
                      onChange={e => setBuyerPhone(e.target.value)}
                      className="w-full"
                      autoComplete="off"
                    />
                    <input
                      type="email"
                      placeholder="Email (optional) — for their account password"
                      value={buyerEmail}
                      onChange={e => setBuyerEmail(e.target.value)}
                      className="w-full"
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-600">The ticket goes on their NXT STOP account. If the number already has one, it&apos;s added there.</p>
                  </div>
                )}

                {!preview.alreadyActivated && !preview.salesClosed && (
                  <button
                    onClick={confirmActivation}
                    disabled={activating || !buyerReady}
                    className="w-full btn-primary mt-4 flex items-center justify-center gap-2"
                  >
                    {activating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {activating ? 'Activating…' : 'Confirm Sale & Activate'}
                  </button>
                )}
                <button onClick={reset} className="w-full mt-2 text-sm text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-1">
                  <X size={12} /> Cancel
                </button>
              </div>
            )}

            {/* Error */}
            {(previewError || error) && (
              <div className="w-full max-w-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 text-center">
                {previewError ?? error}
              </div>
            )}

            {/* Code input */}
            <div className="w-full max-w-sm">
              <label className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2 block">Activation Code</label>
              <input
                ref={inputRef}
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setPreview(null); setPreviewError(null); setError(null) }}
                onKeyDown={e => e.key === 'Enter' && lookupCode(code)}
                placeholder="e.g. A3F9C2"
                className="text-center font-mono text-xl tracking-widest"
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
              />
              <button
                onClick={() => lookupCode(code)}
                disabled={code.trim().length < 6 || previewing}
                className="w-full btn-primary mt-2 flex items-center justify-center gap-2"
              >
                {previewing ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
                {previewing ? 'Looking up…' : 'Look Up Ticket'}
              </button>
            </div>

            <p className="text-xs text-gray-700 text-center max-w-xs">
              The 6-character code is printed on the tear-off stub of each physical ticket. Only activate when cash has been collected.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
