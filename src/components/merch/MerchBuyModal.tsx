'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, CheckCircle, AlertCircle, Phone } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type MerchItem = { id: string; name: string; price: number }

const PAYMENT_METHODS = [
  { id: 'ecocash',  label: 'EcoCash',     mobile: true },
  { id: 'onemoney', label: 'OneMoney',    mobile: true },
  { id: 'innbucks', label: 'InnBucks',    mobile: true },
  { id: 'omari',    label: "O'mari",      mobile: true },
  { id: 'standard', label: 'Card / Bank', mobile: false },
]

type Stage = 'form' | 'processing' | 'pending' | 'paid' | 'failed'

export default function MerchBuyModal({ item, onClose }: { item: MerchItem; onClose: () => void }) {
  const [user, setUser] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [isWhatsApp, setIsWhatsApp] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState('ecocash')
  const [mobileNumber, setMobileNumber] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [message, setMessage] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.success) {
        setUser(d.data)
        setName(d.data.name)
        setPhone(d.data.phone)
      }
    })
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const isMobile = PAYMENT_METHODS.find(m => m.id === paymentMethod)?.mobile ?? false

  const poll = (orderId: string, guestToken?: string) => {
    let count = 0
    pollRef.current = setInterval(async () => {
      count++
      if (count > 72) { clearInterval(pollRef.current!); setStage('failed'); setMessage('Payment timed out'); return }
      try {
        const qs = new URLSearchParams({ orderId, ...(guestToken ? { guestToken } : {}) })
        const res = await fetch(`/api/paynow/poll?${qs}`).then(r => r.json())
        if (res.success && res.data.status === 'paid') {
          clearInterval(pollRef.current!)
          setStage('paid')
        } else if (res.success && res.data.status === 'failed') {
          clearInterval(pollRef.current!)
          setStage('failed')
          setMessage(res.data.message ?? 'Payment failed')
        }
      } catch { /* keep polling */ }
    }, 5000)
  }

  const submit = async () => {
    if (!phone.trim() || !name.trim()) return
    if (!user && !email.trim()) return
    if (isMobile && !mobileNumber.trim()) return

    setStage('processing')
    setMessage('')

    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.id,
          quantity,
          whatsappPhone: phone,
          whatsappName: name,
          email: email.trim() || undefined,
          isWhatsApp,
          ...(user ? {} : { guestPhone: phone, guestName: name }),
        }),
      }).then(r => r.json())

      if (!orderRes.success) { setStage('failed'); setMessage(orderRes.error ?? 'Could not create order'); return }

      const orderId = orderRes.data.order.id
      const guestToken = orderRes.data.guestToken ?? undefined

      const payRes = await fetch('/api/paynow/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, method: paymentMethod, phone: isMobile ? mobileNumber : undefined, guestToken }),
      }).then(r => r.json())

      if (!payRes.success) { setStage('failed'); setMessage(payRes.error ?? 'Payment could not be started'); return }

      if (payRes.data.redirectUrl) {
        window.location.href = payRes.data.redirectUrl
        return
      }

      setStage('pending')
      setMessage(payRes.data.instructions ?? 'Approve the payment on your phone')
      poll(orderId, guestToken)
    } catch {
      setStage('failed')
      setMessage('Network error — please try again')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">{item.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        {stage === 'paid' ? (
          <div className="text-center py-6">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-white font-bold mb-1">Purchase confirmed!</p>
            <p className="text-gray-500 text-sm">Check your email for your redemption code.</p>
            <button onClick={onClose} className="btn-primary mt-4 text-sm">Done</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400">Quantity</label>
              <div className="flex items-center gap-3 mt-1">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg bg-[#2a2a2a] text-white font-bold">−</button>
                <span className="text-white font-bold w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(10, q + 1))} className="w-9 h-9 rounded-lg bg-[#2a2a2a] text-white font-bold">+</button>
              </div>
            </div>

            <input placeholder="Full name *" value={name} onChange={e => setName(e.target.value)} className="w-full" />
            <input placeholder="Phone number *" value={phone} onChange={e => setPhone(e.target.value)} className="w-full" />
            {!user && (
              <>
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={isWhatsApp} onChange={e => setIsWhatsApp(e.target.checked)} />
                  This number is on WhatsApp
                </label>
                <input placeholder="Email * — we'll send your redemption code here" value={email} onChange={e => setEmail(e.target.value)} className="w-full" required />
              </>
            )}

            <div>
              <label className="text-sm text-gray-400">Payment method</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`text-xs py-2 rounded-lg border ${paymentMethod === pm.id ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-[#2a2a2a] text-gray-400'}`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {isMobile && (
              <div>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input placeholder="Mobile money number" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} className="pl-8 w-full" />
                </div>
              </div>
            )}

            {stage === 'pending' && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-300 text-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> {message}
              </div>
            )}
            {stage === 'failed' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={14} /> {message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-white font-black">{formatCurrency(item.price * quantity)}</span>
              <button
                onClick={submit}
                disabled={stage === 'processing' || stage === 'pending' || !name.trim() || !phone.trim() || (!user && !email.trim()) || (isMobile && !mobileNumber.trim())}
                className="btn-primary text-sm px-6 flex items-center gap-2"
              >
                {stage === 'processing' ? <Loader2 size={14} className="animate-spin" /> : null}
                {stage === 'processing' ? 'Processing...' : 'Pay Now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
