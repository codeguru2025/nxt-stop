'use client'

import { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'
import { UsersRound, Plus, X, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Member = {
  userId: string; name: string; phone: string
  referralTotal: number; partnerTotal: number; total: number; joinedAt: string
}
type Team = { id: string; name: string; createdAt: string; members: Member[] }

export default function AdminTeamsClient() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [addPhone, setAddPhone] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    fetch('/api/admin/teams')
      .then(r => r.json())
      .then(d => { if (d.success) setTeams(d.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createTeam = async () => {
    if (!newTeamName.trim()) return
    setCreating(true)
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTeamName.trim() }),
    }).then(r => r.json())
    setCreating(false)
    if (res.success) { setNewTeamName(''); load() }
  }

  const deleteTeam = async (id: string) => {
    setBusy(id)
    await fetch(`/api/admin/teams/${id}`, { method: 'DELETE' })
    setBusy(null)
    load()
  }

  const addMember = async (teamId: string) => {
    const phone = (addPhone[teamId] ?? '').trim()
    if (!phone) return
    setBusy(teamId)
    setError(prev => ({ ...prev, [teamId]: '' }))
    const res = await fetch(`/api/admin/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).then(r => r.json())
    setBusy(null)
    if (res.success) {
      setAddPhone(prev => ({ ...prev, [teamId]: '' }))
      load()
    } else {
      setError(prev => ({ ...prev, [teamId]: res.error ?? 'Failed to add member' }))
    }
  }

  const removeMember = async (teamId: string, userId: string) => {
    setBusy(`${teamId}:${userId}`)
    await fetch(`/api/admin/teams/${teamId}/members?userId=${userId}`, { method: 'DELETE' })
    setBusy(null)
    load()
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <UsersRound size={20} className="text-purple-400" />
            Street Teams
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Group people pushing events — track their referral and partner earnings together</p>
        </div>

        <div className="card p-4 mb-6 flex gap-2">
          <input
            placeholder="New team name (e.g. Harare Street Team)"
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            className="flex-1"
          />
          <button onClick={createTeam} disabled={creating || !newTeamName.trim()} className="btn-primary flex items-center gap-2 text-sm px-4">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Team
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
          </div>
        ) : teams.length === 0 ? (
          <div className="card p-10 text-center">
            <UsersRound size={40} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No teams yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map(team => {
              const teamTotal = team.members.reduce((s, m) => s + m.total, 0)
              return (
                <div key={team.id} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white">{team.name}</h3>
                      <p className="text-gray-600 text-xs">{team.members.length} member{team.members.length !== 1 ? 's' : ''} · {formatCurrency(teamTotal)} total earned</p>
                    </div>
                    <button
                      onClick={() => deleteTeam(team.id)}
                      disabled={busy === team.id}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {team.members.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {team.members.map(m => (
                        <div key={m.userId} className="flex items-center justify-between text-sm bg-[#111] rounded-lg px-3 py-2">
                          <div>
                            <span className="text-white font-medium">{m.name}</span>
                            <span className="text-gray-600 text-xs ml-2">{m.phone}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-green-400 font-semibold text-xs">{formatCurrency(m.total)}</span>
                            <button
                              onClick={() => removeMember(team.id, m.userId)}
                              disabled={busy === `${team.id}:${m.userId}`}
                              className="text-gray-600 hover:text-red-400 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      placeholder="Add member by phone number"
                      value={addPhone[team.id] ?? ''}
                      onChange={e => setAddPhone(prev => ({ ...prev, [team.id]: e.target.value }))}
                      className="flex-1 text-sm"
                    />
                    <button
                      onClick={() => addMember(team.id)}
                      disabled={busy === team.id}
                      className="border border-[#2a2a2a] rounded-lg px-3 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {error[team.id] && <p className="text-red-400 text-xs mt-1.5">{error[team.id]}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
