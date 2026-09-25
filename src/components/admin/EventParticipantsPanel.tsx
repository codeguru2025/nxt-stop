'use client'

import { useEffect, useState } from 'react'
import { Link2, Copy, Check, Loader2, X, MessageCircle, KeyRound } from 'lucide-react'
import { appUrl, buildReferralUrl } from '@/lib/utils'

type Participant = {
  id: string; name: string; role: string
  user: {
    id: string; name: string; phone: string; email: string | null; referralCode: string; mustResetPassword: boolean
    hasOwnPassword: boolean // chose their own password — we can't know it
    canIssuePassword: boolean // account exists only for the line-up, so a new one-time password may be issued
  }
}

type Props = {
  eventId: string
  eventName: string
  eventSlug: string
  eventPublic: boolean // published/live/ended — only then does a link open the event itself
  lineup: { name: string; role: string }[]
  roleLabels: Record<string, string>
}

// Under the line-up editor: marks line-up members as participants of the event, which
// gives each an account and a share link with no ticket purchase.
export default function EventParticipantsPanel({ eventId, eventName, eventSlug, eventPublic, lineup, roleLabels }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [openFor, setOpenFor] = useState<string | null>(null) // line-up name being given a link
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [passwords, setPasswords] = useState<Record<string, string>>({}) // participantId → one-time password, shown once
  const [copied, setCopied] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [issuing, setIssuing] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const earns = percent === null ? 'a share' : `${percent}%`

  useEffect(() => {
    fetch(`/api/admin/events/${eventId}/participants`)
      .then(r => r.json())
      .then(d => { if (d.success) { setParticipants(d.data.participants); setPercent(d.data.referralPercent) } })
      .finally(() => setLoading(false))
  }, [eventId])

  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  // Line-up names without a link yet (first of any duplicate names only)
  const waiting = lineup.filter((a, i) =>
    a.name.trim() && !participants.some(p => same(p.name, a.name)) && lineup.findIndex(b => same(b.name, a.name)) === i)

  const open = (name: string) => { setOpenFor(name); setPhone(''); setEmail(''); setFormError('') }

  const add = async (artist: { name: string; role: string }) => {
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch(`/api/admin/events/${eventId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: artist.name.trim(), role: artist.role || 'guest_dj', phone, email }),
      }).then(r => r.json())
      if (!res.success) { setFormError(res.error ?? 'Could not create the link'); return }
      setParticipants(ps => [...ps, res.data.participant])
      if (res.data.oneTimePassword) setPasswords(pw => ({ ...pw, [res.data.participant.id]: res.data.oneTimePassword }))
      setOpenFor(null)
    } catch {
      setFormError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: Participant) => {
    if (!confirm(`Remove ${p.name} as a participant? Their account and past earnings stay.`)) return
    const res = await fetch(`/api/admin/events/${eventId}/participants?participantId=${p.id}`, { method: 'DELETE' })
      .then(r => r.json()).catch(() => null)
    if (res?.success) setParticipants(ps => ps.filter(x => x.id !== p.id))
  }

  const linkFor = (p: Participant) => buildReferralUrl(p.user.referralCode, eventSlug)

  // One-time passwords are never stored readable, so after a refresh a new one is issued
  // (the old one stops working) rather than sending a message with no way to log in.
  const issuePassword = async (p: Participant): Promise<string | null> => {
    setIssuing(p.id)
    setRowError(e => ({ ...e, [p.id]: '' }))
    try {
      const res = await fetch(`/api/admin/events/${eventId}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: p.id }),
      }).then(r => r.json())
      if (!res.success) { setRowError(e => ({ ...e, [p.id]: res.error ?? 'Could not issue a password' })); return null }
      setPasswords(pw => ({ ...pw, [p.id]: res.data.oneTimePassword }))
      return res.data.oneTimePassword as string
    } catch {
      setRowError(e => ({ ...e, [p.id]: 'Network error — please try again' }))
      return null
    } finally {
      setIssuing(null)
    }
  }

  const messageFor = (p: Participant, pwOverride?: string) => {
    const base = appUrl()
    const pw = pwOverride ?? passwords[p.id]
    // "Forgot password?" works by email only, so people without one are asked to reply instead
    const stuck = p.user.email
      ? `Tap “Forgot password?” on the login page`
      : `Reply to this message and we'll reset it for you`
    const login = pw
      ? `Log in at ${base}/login with ${p.user.phone} and your one-time password ${pw} (you'll then choose your own password) to see your sales and earnings.`
      : p.user.hasOwnPassword
        ? `Log in at ${base}/login with ${p.user.phone} and your NXT STOP password to see your sales and earnings. Forgot it? ${stuck}.`
        : `Log in at ${base}/login with ${p.user.phone} and the one-time password ${p.user.email ? 'we emailed you' : 'you were given'} when you bought your ticket. Can't find it? ${stuck}.`
    return [
      `Hi ${p.name}! You're on the line-up for ${eventName} 🎤`,
      `Here's your personal NXT STOP link to share with your fans:`,
      linkFor(p),
      `You earn ${earns} of everything bought through it.`,
      login,
    ].join('\n')
  }

  const copyMessage = async (p: Participant) => {
    let pw: string | null | undefined = passwords[p.id]
    if (!pw && p.user.canIssuePassword) {
      pw = await issuePassword(p)
      if (!pw) return
    }
    // After the network wait some browsers (Safari) refuse the clipboard; the password is
    // now on screen, so a second tap copies straight away.
    const done = await copy(`m-${p.id}`, messageFor(p, pw ?? undefined))
    setRowError(e => ({ ...e, [p.id]: done ? '' : 'Password ready (shown above), but your browser blocked copying. Tap “Copy WhatsApp message” again.' }))
  }

  // Shows ✓ only when the text really reached the clipboard
  const copy = async (key: string, text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return false
    }
    setCopied(key)
    setTimeout(() => setCopied(c => (c === key ? null : c)), 2000)
    return true
  }

  return (
    <div className="mt-2 p-4 bg-[#111] rounded-xl border border-[#2a2a2a]">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={14} className="text-purple-400" />
        <span className="text-sm font-bold text-white">Share links for the line-up</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Mark line-up members as participants: each gets an account and their own share link — no ticket purchase needed — and earns {earns} of everything bought through it.
      </p>
      {!eventPublic && (
        <p className="text-xs text-yellow-500 mb-3">
          This event isn&apos;t published yet — until it is, these links open the events list instead of the event.
        </p>
      )}

      {loading ? (
        <Loader2 size={16} className="animate-spin text-purple-400" />
      ) : (
        <>
          {participants.map(p => (
            <div key={p.id} className="mb-3 p-3 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-sm font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {roleLabels[p.role] ?? p.role} · {p.user.phone}
                    {p.user.mustResetPassword && !p.user.hasOwnPassword && <span className="text-yellow-500"> · hasn&apos;t logged in yet</span>}
                  </div>
                </div>
                <button type="button" onClick={() => remove(p)} title="Remove participant" className="text-gray-600 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>

              {passwords[p.id] && (
                <div className="flex items-start gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 mb-2">
                  <KeyRound size={13} className="shrink-0 mt-0.5" />
                  <span>
                    One-time password <strong className="font-mono">{passwords[p.id]}</strong>.
                    {p.user.email ? ' It was also emailed to them.' : ' Send it to them — it’s only shown now.'} It’s in the WhatsApp message.
                  </span>
                </div>
              )}

              <div className="font-mono text-xs text-gray-400 bg-[#111] border border-[#2a2a2a] rounded-md px-2 py-1.5 truncate mb-2">
                {linkFor(p)}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(`l-${p.id}`, linkFor(p))} className="flex items-center gap-1.5 text-xs text-purple-300 border border-purple-500/30 rounded-md px-2.5 py-1.5 hover:bg-purple-500/10">
                  {copied === `l-${p.id}` ? <Check size={12} /> : <Copy size={12} />} Copy link
                </button>
                <button type="button" onClick={() => copyMessage(p)} disabled={issuing === p.id} className="flex items-center gap-1.5 text-xs text-green-300 border border-green-500/30 rounded-md px-2.5 py-1.5 hover:bg-green-500/10 disabled:opacity-60">
                  {issuing === p.id ? <Loader2 size={12} className="animate-spin" /> : copied === `m-${p.id}` ? <Check size={12} /> : <MessageCircle size={12} />}
                  {!passwords[p.id] && p.user.canIssuePassword ? 'Copy message with new password' : 'Copy WhatsApp message'}
                </button>
              </div>
              {!passwords[p.id] && p.user.canIssuePassword && (
                <p className="text-[11px] text-gray-600 mt-1.5">Creates a fresh one-time password for their login{p.user.email ? ' and emails it' : ''}. Any earlier one stops working.</p>
              )}
              {!passwords[p.id] && !p.user.canIssuePassword && (
                <p className="text-[11px] text-gray-600 mt-1.5">
                  {p.user.hasOwnPassword ? 'They already have their own password.' : 'This account has ticket purchases, so it keeps the password from checkout.'} The message tells them what to do if they can&apos;t log in.
                </p>
              )}
              {rowError[p.id] && <p className="text-xs text-red-400 mt-1.5">{rowError[p.id]}</p>}
            </div>
          ))}

          {waiting.map(artist => (
            <div key={artist.name.trim().toLowerCase()} className="mb-2">
              {openFor === artist.name ? (
                <div className="p-3 rounded-lg border border-purple-500/30 bg-[#0d0d0d]">
                  <div className="text-sm text-white mb-2">
                    Give <strong>{artist.name}</strong> a share link
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input type="tel" placeholder="Phone (their login) *" value={phone} onChange={e => setPhone(e.target.value)} />
                    <input type="email" placeholder="Email (optional — login details sent here)" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">If this phone already has an account, it&apos;s used as-is — they keep their password.</p>
                  {formError && <p className="text-xs text-red-400 mt-2">{formError}</p>}
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => add(artist)} disabled={saving || !phone.trim()} className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Create link
                    </button>
                    <button type="button" onClick={() => setOpenFor(null)} className="text-xs text-gray-500 hover:text-white border border-[#2a2a2a] rounded-md px-3 py-1.5">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-300">
                    {artist.name} <span className="text-xs text-gray-600">· {roleLabels[artist.role] ?? artist.role}</span>
                  </span>
                  <button type="button" onClick={() => open(artist.name)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <Link2 size={12} /> Give share link
                  </button>
                </div>
              )}
            </div>
          ))}

          {participants.length === 0 && waiting.length === 0 && (
            <p className="text-xs text-gray-600">Add names to the line-up above, then give them share links here.</p>
          )}
        </>
      )}
    </div>
  )
}
