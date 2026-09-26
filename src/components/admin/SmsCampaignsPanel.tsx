'use client'

import { useEffect, useState } from 'react'
import { Loader2, Megaphone, Send, Square, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type TemplateInfo = { label: string; audience: string; event: 'upcoming' | 'past' | null; fields: ('price' | 'deadline' | 'ticketType')[] }
type Campaign = {
  id: string; template: string; preview: string; audience: number; sent: number; failed: number
  status: string; stopReason: string | null; createdByName: string; createdAt: string
}
type Data = { templates: Record<string, TemplateInfo>; events: { id: string; name: string; date: string }[]; campaigns: Campaign[]; enabled: boolean }
type Preview = { audience: number; sample: string; creditsNeeded: number; creditsLeft: number; alreadySent: number; eventName: string | null }

/** Promotional SMS to many people at once. Needs the Events capability; sending needs a second admin's approval. */
export default function SmsCampaignsPanel({ onSent }: { onSent: () => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [template, setTemplate] = useState('')
  const [eventId, setEventId] = useState('')
  const [price, setPrice] = useState('')
  const [deadline, setDeadline] = useState('')
  const [ticketType, setTicketType] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = () =>
    fetch('/api/admin/sms/campaigns').then(r => r.json()).then(d => { if (d.success) setData(d.data) }).catch(() => {})

  useEffect(() => { load() }, [])

  // Keep the history moving while something is sending
  useEffect(() => {
    if (!data?.campaigns.some(c => c.status === 'sending')) return
    const t = setInterval(() => { load(); onSent() }, 5000)
    return () => clearInterval(t)
  }, [data, onSent])

  if (!data) return null // no Events capability, or still loading

  const info = template ? data.templates[template] : null
  const events = info?.event === 'upcoming'
    ? data.events.filter(e => new Date(e.date) > new Date())
    : info?.event === 'past' ? data.events.filter(e => new Date(e.date) <= new Date()) : []

  const payload = (action: 'preview' | 'send') => ({
    action, template,
    eventId: info?.event ? eventId || undefined : undefined,
    price: info?.fields.includes('price') && price ? Number(price) : undefined,
    deadline: info?.fields.includes('deadline') ? deadline : undefined,
    ticketType: info?.fields.includes('ticketType') ? ticketType : undefined,
  })

  const post = async (body: unknown) => {
    setBusy(true)
    setMsg(null)
    try {
      return await fetch('/api/admin/sms/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json())
    } catch {
      setMsg({ kind: 'error', text: 'Network error — please try again' })
      return null
    } finally {
      setBusy(false)
    }
  }

  const doPreview = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await post(payload('preview'))
    if (!res) return
    if (res.success) setPreview(res.data)
    else { setPreview(null); setMsg({ kind: 'error', text: res.error ?? 'Could not preview' }) }
  }

  const doSend = async () => {
    if (!preview) return
    if (!confirm(`Send this to ${preview.audience} people? It uses ${preview.creditsNeeded} SMS credits.`)) return
    const res = await post(payload('send'))
    if (!res) return
    // Normally held for a second admin (202, pendingApproval); the platform creator sends straight away
    if (res.success || res.pendingApproval) {
      setMsg({ kind: 'ok', text: res.success ? res.data.message : res.error })
      setPreview(null)
      load()
      onSent()
    } else {
      setMsg({ kind: 'error', text: res.error ?? 'Could not send' })
    }
  }

  const stop = async (id: string) => {
    const res = await post({ action: 'stop', campaignId: id })
    if (res) setMsg(res.success ? { kind: 'ok', text: res.data.message } : { kind: 'error', text: res.error })
    load()
  }

  const reset = () => { setPreview(null); setMsg(null) }

  return (
    <div className="mb-6">
      <form onSubmit={doPreview} className="card p-4 mb-3 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Megaphone size={15} className="text-purple-400" /> Promotional SMS</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Goes only to people who haven&apos;t opted out; each message ends with an opt-out link. A second admin approves before it sends.
          </p>
        </div>
        <select value={template} onChange={e => { setTemplate(e.target.value); setEventId(''); reset() }} required className="w-full">
          <option value="">Choose a message…</option>
          {Object.entries(data.templates).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
        </select>
        {info && <p className="text-xs text-gray-500">Goes to: {info.audience}</p>}
        {info?.event && (
          <select value={eventId} onChange={e => { setEventId(e.target.value); reset() }} required className="w-full">
            <option value="">Choose the event…</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name} · {formatDate(e.date, 'd MMM yyyy')}</option>)}
          </select>
        )}
        {info?.fields.includes('price') && (
          <input type="number" min={0} step="0.01" value={price} onChange={e => { setPrice(e.target.value); reset() }} placeholder="Price to advertise (blank = cheapest on sale)" className="w-full" />
        )}
        {info?.fields.includes('deadline') && (
          <input value={deadline} onChange={e => { setDeadline(e.target.value); reset() }} maxLength={40} placeholder='When early bird ends, e.g. "Friday midnight"' required className="w-full" />
        )}
        {info?.fields.includes('ticketType') && (
          <input value={ticketType} onChange={e => { setTicketType(e.target.value); reset() }} maxLength={40} placeholder='Which tickets are almost gone, e.g. "VIP"' required className="w-full" />
        )}
        {!data.enabled && <p className="text-xs text-orange-400">SMS is switched off on the server, so nothing can be sent.</p>}
        <button type="submit" disabled={busy || !template} className="w-full flex items-center justify-center gap-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
          {busy && !preview ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
        </button>

        {preview && (
          <div className="rounded-xl border border-[#2a2a2a] p-3 space-y-2">
            <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">{preview.sample}</p>
            <p className="text-xs text-gray-400">
              {preview.audience} people · {preview.creditsNeeded} credits of {preview.creditsLeft} left
            </p>
            {preview.alreadySent > 0 && (
              <p className="text-xs text-orange-400">This message was already sent {preview.alreadySent} time(s){preview.eventName ? ` for ${preview.eventName}` : ''}.</p>
            )}
            {preview.creditsNeeded > preview.creditsLeft && (
              <p className="text-xs text-red-400">Not enough credits — record more before sending.</p>
            )}
            <button
              type="button"
              onClick={doSend}
              disabled={busy || !data.enabled || preview.audience === 0 || preview.creditsNeeded > preview.creditsLeft}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to {preview.audience} people
            </button>
          </div>
        )}
        {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      </form>

      {data.campaigns.length > 0 && (
        <div className="card divide-y divide-[#2a2a2a] overflow-hidden">
          {data.campaigns.map(c => (
            <div key={c.id} className="p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-gray-100 min-w-0">
                  {data.templates[c.template]?.label ?? c.template}
                  <span className="text-gray-500"> · by {c.createdByName}</span>
                </p>
                <span className="text-xs text-gray-500 shrink-0">{formatDate(c.createdAt, 'd MMM, h:mm a')}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {c.status === 'sending' ? 'Sending… ' : c.status === 'stopped' ? 'Stopped · ' : 'Done · '}
                {c.sent} of {c.audience} sent{c.failed > 0 ? `, ${c.failed} not sent` : ''}
                {c.stopReason && <span className="text-orange-400"> · {c.stopReason}</span>}
              </p>
              {c.status === 'sending' && (
                <button onClick={() => stop(c.id)} disabled={busy} className="mt-1 text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                  <Square size={11} /> Stop sending
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
