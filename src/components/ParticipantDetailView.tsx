import { useEffect, useMemo, useState } from 'react'
import {
  addReferral,
  deleteParticipant,
  getParticipantDetail,
  listParticipants,
  signupLinkForCode,
  updateParticipant,
  updateParticipantStatus,
} from '../services/dataService'
import type { Participant, ParticipantDetail, ParticipantStatus } from '../types'
import { StatusBadge } from './StatusBadge'

interface Props {
  participantId: string
  onBack: () => void
  onOpen: (id: string) => void
}

export function ParticipantDetailView({ participantId, onBack, onOpen }: Props) {
  const [detail, setDetail] = useState<ParticipantDetail | null>(null)
  const [candidates, setCandidates] = useState<Participant[]>([])
  const [referralPickId, setReferralPickId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editZip, setEditZip] = useState('')
  const [editGrade, setEditGrade] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setError(null)
    try {
      const [d, all] = await Promise.all([
        getParticipantDetail(participantId),
        listParticipants(),
      ])
      setDetail(d)
      if (d) {
        setCandidates(
          all.filter(
            (p) =>
              p.id !== participantId &&
              !p.referredById &&
              p.createdAt > d.createdAt,
          ),
        )
      } else {
        setCandidates([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load detail')
    }
  }

  useEffect(() => {
    void load()
    setEditing(false)
  }, [participantId])

  const link = useMemo(
    () => (detail ? signupLinkForCode(detail.referralCode) : ''),
    [detail],
  )

  function startEdit() {
    if (!detail) return
    setEditName(detail.parentName)
    setEditEmail(detail.email)
    setEditZip(detail.zip)
    setEditGrade(detail.grade)
    setEditing(true)
    setError(null)
  }

  async function saveEdit() {
    if (!detail) return
    setSaving(true)
    setError(null)
    try {
      await updateParticipant(detail.id, {
        parentName: editName,
        email: editEmail,
        zip: editZip,
        grade: editGrade,
      })
      setEditing(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!detail) return
    if (!window.confirm(`Delete ${detail.parentName}? This also removes them from Supabase.`)) {
      return
    }
    try {
      await deleteParticipant(detail.id)
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (!detail && !error) {
    return <p className="px-4 py-10 text-center text-ink-muted">Loading…</p>
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button type="button" onClick={onBack} className="text-sm text-blue hover:underline">
          ← Back
        </button>
        <p className="mt-4 text-danger">{error ?? 'Not found'}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-blue hover:underline">
          ← All participants
        </button>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-lg border border-line bg-surface-elevated px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface-warm"
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface-elevated p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-ink-soft">Parent name</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-ink-soft">Email</span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-soft">ZIP</span>
                  <input
                    value={editZip}
                    onChange={(e) => setEditZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    className="w-full rounded-lg border border-line px-3 py-2 font-mono"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-soft">Grade</span>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  >
                    <option>6th grade</option>
                    <option>7th grade</option>
                    <option>8th grade</option>
                    <option>Multiple kids</option>
                  </select>
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveEdit()}
                    className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-ink disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setError(null)
                    }}
                    className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl font-semibold text-ink">{detail.parentName}</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  {detail.email} · {detail.zip} · {detail.grade}
                </p>
              </>
            )}
          </div>
          <StatusBadge status={detail.status} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Status</span>
            <select
              value={detail.status}
              onChange={(e) => {
                const status = e.target.value as ParticipantStatus
                void updateParticipantStatus(detail.id, status).then(load)
              }}
              className="w-full rounded-lg border border-line bg-white px-3 py-2"
            >
              <option value="waitlisted">Waitlisted</option>
              <option value="registered">Registered</option>
              <option value="enrolled">Enrolled</option>
              <option value="declined">Declined</option>
            </select>
          </label>
          <div className="text-sm">
            <span className="mb-1 block font-medium text-ink-soft">Referral code</span>
            <div className="rounded-lg border border-line bg-surface-warm px-3 py-2 font-mono font-semibold">
              {detail.referralCode}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-sm font-medium text-ink-soft">Share link</span>
          <div className="flex flex-wrap gap-2">
            <code className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs break-all">
              {link}
            </code>
            <button
              type="button"
              className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-ink"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-lg bg-surface-warm px-4 py-3 text-sm">
          <span className="font-medium text-ink-soft">Referred by: </span>
          {detail.referredBy ? (
            <button
              type="button"
              className="font-semibold text-blue hover:underline"
              onClick={() => onOpen(detail.referredBy!.id)}
            >
              {detail.referredBy.parentName}
            </button>
          ) : (
            <span className="text-ink-muted">No referral</span>
          )}
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface-elevated p-6">
        <h2 className="font-display text-xl font-semibold">Children</h2>
        {detail.children.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No children on file (waitlist-only or not provided).</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {detail.children.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="font-medium">{c.firstName}</span>
                <span className="text-ink-muted">{c.grade}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface-elevated p-6">
        <h2 className="font-display text-xl font-semibold">People they referred</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {detail.referralsMade.length} referral
          {detail.referralsMade.length === 1 ? '' : 's'}
        </p>

        {detail.referralsMade.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No referrals yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {detail.referralsMade.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  {r.referredId ? (
                    <button
                      type="button"
                      className="font-medium text-blue hover:underline"
                      onClick={() => onOpen(r.referredId!)}
                    >
                      {r.referredName}
                    </button>
                  ) : (
                    <span className="font-medium">{r.referredName}</span>
                  )}
                  <div className="text-xs text-ink-muted">
                    {r.referredEmail} ·{' '}
                    {r.submissionMethod === 'staff_attributed'
                      ? 'manual referral'
                      : r.submissionMethod === 'link'
                        ? 'invite link'
                        : 'direct signup'}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface-elevated p-6">
        <h2 className="font-display text-xl font-semibold">Add a referral</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Link someone who signed up after this person and doesn’t already have a referral.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={referralPickId}
            onChange={(e) => setReferralPickId(e.target.value)}
            className="min-w-[220px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">
              {candidates.length === 0
                ? 'No eligible people…'
                : 'Select someone without a referral…'}
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentName} ({c.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!referralPickId}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-gold-deep"
            onClick={() => {
              void addReferral(detail.id, referralPickId)
                .then(() => {
                  setReferralPickId('')
                  return load()
                })
                .catch((e: unknown) =>
                  setError(e instanceof Error ? e.message : 'Could not add referral'),
                )
            }}
          >
            Add referral
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </section>
    </div>
  )
}
