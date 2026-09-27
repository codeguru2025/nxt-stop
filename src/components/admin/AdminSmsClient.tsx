'use client'

import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import SmsCampaignsPanel from './SmsCampaignsPanel'
import { MessageSquare, Loader2, AlertTriangle, Plus, Lock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type TopUp = { id: string; credits: number; note: string | null; addedByName: string; createdAt: string }
type Message = { id: string; purpose: string; phone: string; status: string; segments: number; reference: string | null; error: string | null; createdAt: string }
type AutoSms = { key: string; label: string; when: string; email: 'always' | 'fallback'; on: boolean }
type Summary =
  | { ready: false; enabled: boolean; canAddCredits: boolean }
  | {
      ready: true; enabled: boolean; emailEnabled: boolean; canAddCredits: boolean; lowThreshold: number
      otpReserve: number; owedPaymentSms: number
      autoSms: AutoSms[]
      credits: { bought: number; used: number; remaining: number }
      week: { sent: number; failed: number; noCredit: number; emailed: number }
      topUps: TopUp[]; messages: Message[]
    }

const PURPOSE: Record<string, string> = {
  'order.paid': 'Payment confirmation',
  'order.pending': 'Approve payment prompt',
  'order.failed': 'Payment failed',
  'order.delayed': 'Tickets delayed',
  'order.refunded': 'Refund',
  'account.welcome': 'Welcome / one-time password',
  'lineup.login': 'Line-up login',
  'auth.password-reset': 'Password reset link',
  'auth.password-changed': 'Password changed',
  'auth.login-code': 'Login code',
  'auth.phone-change-code': 'Phone change code',
  'referral.reward': 'Referral reward',
  'ticket.transfer': 'Ticket transfer',
  'event.reminder-tomorrow': 'Reminder: tomorrow',
  'event.reminder-today': 'Reminder: today',
  'campaign.new-event': 'Promo: new event',
  'campaign.early-bird': 'Promo: early bird',
  'campaign.almost-sold-out': 'Promo: almost sold out',
  'campaign.last-chance': 'Promo: last chance',
  'campaign.share-link': 'Promo: share your link',
  'campaign.thank-you': 'Promo: thank you',
  'campaign.win-back': 'Promo: win back',
}
const STATUS: Record<string, { label: string; className: string }> = {
  sent: { label: 'Sent', className: 'text-green-400' },
  failed: { label: 'Failed', className: 'text-red-400' },
  no_credit: { label: 'No credits', className: 'text-orange-400' },
  emailed: { label: 'Emailed instead', className: 'text-sky-400' },
}

export default function AdminSmsClient() {
  const [data, setData] = useState<Summary | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [credits, setCredits] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = () =>
    fetch('/api/admin/sms').then(r => r.json()).then(d => {
      if (d.success) setData(d.data)
      else setForbidden(true)
    }).catch(() => setForbidden(true))

  useEffect(() => { load() }, [])

  const addCredits = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credits: Number(credits), note }),
      })
      const d = await res.json()
      if (!d.success) { setFormError(d.error ?? 'Could not save'); return }
      setCredits('')
      setNote('')
      await load()
    } catch {
      setFormError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (forbidden) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div className="card p-8 text-center max-w-sm">
            <Lock size={24} className="text-red-400 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Only admins can view SMS credits.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const low = data?.ready && data.credits.remaining <= data.lowThreshold

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <MessageSquare size={20} className="text-purple-400" />
            SMS
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            SMS credits bought and used, and promotional messages. Customers always get their tickets by email and WhatsApp too, so if credits run out nobody misses their tickets.
          </p>
        </div>

        {!data ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : !data.ready ? (
          <div className="card p-6 text-sm text-gray-400">
            SMS tracking isn&apos;t set up on the database yet. Run the <code className="text-gray-300">20260925150000_sms_credits</code> migration, then reload this page.
          </div>
        ) : (
          <>
            {!data.enabled && (
              <div className="card p-4 mb-4 text-sm text-gray-400">
                SMS sending is switched off on the server (<code className="text-gray-300">SMS_PROVIDER</code> isn&apos;t set). Credits below are still tracked.
              </div>
            )}
            {low && (
              <div className="card p-4 mb-4 flex gap-3 border-orange-500/30 bg-orange-500/[0.06]">
                <AlertTriangle size={18} className="text-orange-400 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-100">
                  {data.credits.remaining <= data.otpReserve
                    ? `SMS credits are nearly used up. The last ${data.otpReserve} are kept for sign-in and phone-change codes, so other messages are going by email, and customers still get their tickets by email and WhatsApp.`
                    : `Only ${data.credits.remaining} SMS credits left.`}
                  {data.canAddCredits ? ' Buy more from SMSala, then record them below.' : ' Ask the platform creator to buy more.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <Stat label="Credits left" value={data.credits.remaining} tone={low ? 'warn' : 'normal'} />
              <Stat label="Credits bought (all time)" value={data.credits.bought} />
              <Stat label="Credits used (all time)" value={data.credits.used} />
            </div>

            <p className="text-sm text-gray-400 mb-6">
              Last 7 days: <span className="text-white font-semibold">{data.week.sent}</span> sent
              {data.week.failed > 0 && <>, <span className="text-red-400 font-semibold">{data.week.failed}</span> failed</>}
              {data.week.emailed > 0 && <>, <span className="text-sky-400 font-semibold">{data.week.emailed}</span> emailed instead</>}
              {data.week.noCredit > 0 && <>, <span className="text-orange-400 font-semibold">{data.week.noCredit}</span> not sent (no credits)</>}
            </p>

            {data.owedPaymentSms > 0 && (
              <p className="text-sm text-gray-400 mb-6">
                <span className="text-white font-semibold">{data.owedPaymentSms.toLocaleString()}</span> ticket buyer{data.owedPaymentSms === 1 ? ' is' : 's are'} still
                owed a payment confirmation SMS (events not over yet). They are texted automatically as soon as there are credits
                and the payment confirmation SMS is on, oldest first.
              </p>
            )}

            {data.canAddCredits && (
              <form onSubmit={addCredits} className="card p-4 mb-6">
                <h2 className="text-sm font-semibold text-white mb-1">Record SMS credits bought</h2>
                <p className="text-xs text-gray-500 mb-3">Only the platform creator can do this. Use a negative number to correct a mistake.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="number"
                    step={1}
                    placeholder="Credits, e.g. 5000"
                    value={credits}
                    onChange={e => setCredits(e.target.value)}
                    className="sm:w-44"
                    required
                  />
                  <input
                    placeholder="Note, e.g. SMSala invoice #1234"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    maxLength={200}
                    className="flex-1"
                  />
                  <button type="submit" disabled={saving || !credits} className="btn-primary flex items-center justify-center gap-1.5">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
                {formError && <p className="text-xs text-red-400 mt-2">{formError}</p>}
              </form>
            )}

            <AutoSmsPanel
              messages={data.autoSms}
              canEdit={data.canAddCredits}
              emailEnabled={data.emailEnabled}
              onSaved={autoSms => setData({ ...data, autoSms })}
            />

            <SmsCampaignsPanel onSent={load} />

            <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Credits bought</h2>
            {data.topUps.length === 0 ? (
              <div className="card p-4 mb-6 text-sm text-gray-500">No SMS credits recorded yet, so no SMS will be sent.</div>
            ) : (
              <div className="card divide-y divide-[#2a2a2a] overflow-hidden mb-6">
                {data.topUps.map(t => (
                  <div key={t.id} className="p-3 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className={t.credits < 0 ? 'text-orange-300' : 'text-white'}>
                        {t.credits > 0 ? '+' : ''}{t.credits.toLocaleString()} credits
                        <span className="text-gray-500"> · by {t.addedByName}</span>
                      </p>
                      {t.note && <p className="text-xs text-gray-400 mt-0.5 break-words">{t.note}</p>}
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{formatDate(t.createdAt, 'd MMM yyyy, h:mm a')}</span>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Recent SMS</h2>
            {data.messages.length === 0 ? (
              <div className="card p-4 text-sm text-gray-500">No SMS sent yet.</div>
            ) : (
              <div className="card divide-y divide-[#2a2a2a] overflow-hidden">
                {data.messages.map(m => {
                  const s = STATUS[m.status] ?? { label: m.status, className: 'text-gray-400' }
                  return (
                    <div key={m.id} className="p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-gray-100 min-w-0 break-words">
                          {PURPOSE[m.purpose] ?? m.purpose}
                          <span className="text-gray-500"> · {m.phone}{m.reference ? ` · ${m.reference}` : ''}</span>
                        </p>
                        <span className="text-xs text-gray-500 shrink-0">{formatDate(m.createdAt, 'd MMM, h:mm a')}</span>
                      </div>
                      <p className={`text-xs mt-0.5 ${s.className}`}>
                        {s.label}{m.status === 'sent' && m.segments > 1 ? ` (${m.segments} credits)` : ''}
                        {m.error && <span className="text-gray-500"> · {m.error}</span>}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function AutoSmsPanel({ messages, canEdit, emailEnabled, onSaved }: {
  messages: AutoSms[]; canEdit: boolean; emailEnabled: boolean; onSaved: (messages: AutoSms[]) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const toggle = async (key: string) => {
    const next = messages.map(m => (m.key === key ? { ...m, on: !m.on } : m))
    setBusy(key)
    setErr(null)
    try {
      const res = await fetch('/api/admin/sms', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ switchedOff: next.filter(m => !m.on).map(m => m.key) }),
      }).then(r => r.json())
      if (!res.success) { setErr(res.error ?? 'Could not save'); return }
      onSaved(next)
    } catch {
      setErr('Network error — please try again')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mb-6">
      <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Automatic SMS</h2>
      <p className="text-xs text-gray-500 mb-2">
        When a message is off, or credits run out, it goes by email instead to anyone with an email address.
        {!emailEnabled && <span className="text-orange-400"> Email isn&apos;t set up on this server, so switched-off messages won&apos;t reach anyone.</span>}
        {!canEdit && ' Only the platform creator can switch messages on and off.'}
      </p>
      <div className="card divide-y divide-[#2a2a2a] overflow-hidden">
        {messages.map(m => (
          <div key={m.key} className="p-3 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className={m.on ? 'text-white' : 'text-gray-500'}>{m.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {m.when} · {m.email === 'always' ? 'an email always goes too' : m.on ? 'email if the SMS can’t go' : 'sent by email instead'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={m.on}
              aria-label={`${m.label} SMS`}
              disabled={!canEdit || busy !== null}
              onClick={() => toggle(m.key)}
              className={`relative w-10 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50 ${m.on ? 'bg-purple-600' : 'bg-[#333]'}`}
            >
              {busy === m.key
                ? <Loader2 size={12} className="animate-spin absolute inset-0 m-auto text-white" />
                : <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${m.on ? 'left-5' : 'left-1'}`} />}
            </button>
          </div>
        ))}
      </div>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
    </div>
  )
}

function Stat({ label, value, tone = 'normal' }: { label: string; value: number; tone?: 'normal' | 'warn' }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-black mt-1 ${tone === 'warn' ? 'text-orange-400' : 'text-white'}`}>{value.toLocaleString()}</p>
    </div>
  )
}
