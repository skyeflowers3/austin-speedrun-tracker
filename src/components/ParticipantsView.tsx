import { useEffect, useMemo, useState } from 'react'
import { deleteParticipant, listParticipants, resetDemoData, usingMockData } from '../services/dataService'
import type { Participant, ParticipantStatus } from '../types'
import { AddParticipantForm } from './AddParticipantForm'
import { ConfirmDialog } from './ConfirmDialog'
import { Notice } from './Notice'
import { StatusBadge } from './StatusBadge'

type Filter = 'all' | 'referred' | 'organic' | 'has_referrals'

interface Props {
  onOpen: (id: string) => void
}

export function ParticipantsView({ onOpen }: Props) {
  const [rows, setRows] = useState<Participant[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ParticipantStatus | 'all'>('all')
  const [filter, setFilter] = useState<Filter>('all')
  const [zip, setZip] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRows(await listParticipants())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load participants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete
    setPendingDelete(null)
    try {
      await deleteParticipant(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const referralCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of rows) {
      if (!p.referredById) continue
      counts.set(p.referredById, (counts.get(p.referredById) ?? 0) + 1)
    }
    return counts
  }, [rows])

  const referrerNames = useMemo(() => {
    const map = new Map(rows.map((p) => [p.id, p.parentName]))
    return map
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (zip && p.zip !== zip) return false
      if (filter === 'referred' && !p.referredById) return false
      if (filter === 'organic' && p.referredById) return false
      if (filter === 'has_referrals' && !(referralCounts.get(p.id) ?? 0)) return false
      if (!q) return true
      return (
        p.parentName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.referralCode.toLowerCase().includes(q) ||
        p.zip.includes(q)
      )
    })
  }, [rows, query, status, zip, filter, referralCounts])

  const zips = useMemo(
    () => Array.from(new Set(rows.map((p) => p.zip))).sort(),
    [rows],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-widest text-gold-deep uppercase">
            Tracker
          </p>
          <h1 className="font-display text-3xl font-semibold text-ink">Participants</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddParticipantForm onCreated={() => void load()} />
          {usingMockData() && (
            <button
              type="button"
              className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-warm"
              onClick={() => {
                void resetDemoData().then(load)
              }}
            >
              Reset demo data
            </button>
          )}
        </div>
      </div>

      {usingMockData() && (
        <Notice className="mb-4">
          Tracker is on <b>mock data</b>. Connect Supabase (<code className="font-mono">.env</code>) to
          see real signups from <code className="font-mono">parents.html#join</code>. Until then, use{' '}
          <b>Add participant</b>.
        </Notice>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, code, zip"
          className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ParticipantStatus | 'all')}
          className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="registered">Registered</option>
          <option value="enrolled">Enrolled</option>
          <option value="declined">Declined</option>
        </select>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm"
        >
          <option value="all">All participants</option>
          <option value="referred">Was referred</option>
          <option value="organic">Organic</option>
          <option value="has_referrals">Has referrals</option>
        </select>
        <select
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm"
        >
          <option value="">All zips</option>
          {zips.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface-elevated">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-warm text-xs tracking-wide text-ink-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Parent</th>
              <th className="px-4 py-3 font-semibold">Zip</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Referred by</th>
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Referrals</th>
              <th className="px-4 py-3 font-semibold"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  No participants match.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-line hover:bg-surface-warm/60"
                >
                  <td
                    className="cursor-pointer px-4 py-3"
                    onClick={() => onOpen(p.id)}
                  >
                    <div className="font-medium text-ink">{p.parentName}</div>
                    <div className="text-xs text-ink-muted">{p.email}</div>
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3 font-mono text-xs"
                    onClick={() => onOpen(p.id)}
                  >
                    {p.zip}
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3"
                    onClick={() => onOpen(p.id)}
                  >
                    <StatusBadge status={p.status} />
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3 text-ink-soft"
                    onClick={() => onOpen(p.id)}
                  >
                    {p.referredById ? referrerNames.get(p.referredById) ?? '—' : '—'}
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3 font-mono text-xs font-semibold text-navy"
                    onClick={() => onOpen(p.id)}
                  >
                    {p.referralCode}
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3 font-mono text-xs"
                    onClick={() => onOpen(p.id)}
                  >
                    {referralCounts.get(p.id) ?? 0}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDelete({ id: p.id, name: p.parentName })
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete ${pendingDelete?.name ?? ''}?`}
        body="This removes them from the Tracker and Supabase, including their kids and referral links."
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
