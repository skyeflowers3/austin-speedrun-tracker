import { useState } from 'react'
import { createParticipant } from '../services/dataService'
import { Notice } from './Notice'

interface Props {
  onCreated: () => void
}

const GRADES = ['6th grade', '7th grade', '8th grade', 'Multiple kids']

export function AddParticipantForm({ onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [zip, setZip] = useState('')
  const [grade, setGrade] = useState('')
  const [referralCodeFromLink, setReferralCodeFromLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createParticipant({
        parentName,
        email,
        zip,
        grade,
        referralCodeFromLink: referralCodeFromLink || null,
        submissionMethod: referralCodeFromLink ? 'link' : 'direct_submit',
      })
      setParentName('')
      setEmail('')
      setZip('')
      setGrade('')
      setReferralCodeFromLink('')
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add participant')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-ink"
        onClick={() => setOpen(true)}
      >
        Add participant
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="w-full max-w-xl rounded-xl border border-line bg-surface-elevated p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Add participant</h2>
        <button
          type="button"
          className="text-sm text-ink-muted hover:text-ink"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Use this until Formspree → Supabase is live. Enter a waitlist submission manually (or
        re-type one you already sent to Formspree).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Parent name</span>
          <input
            required
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">ZIP</span>
          <input
            required
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            className="w-full rounded-lg border border-line px-3 py-2 font-mono"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Grade</span>
          <select
            required
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2"
          >
            <option value="">Select…</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Referrer code (optional)</span>
          <input
            value={referralCodeFromLink}
            onChange={(e) =>
              setReferralCodeFromLink(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
            }
            placeholder="e.g. MAYA7K"
            className="w-full rounded-lg border border-line px-3 py-2 font-mono"
          />
        </label>
      </div>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-deep disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save to tracker'}
      </button>
    </form>
  )
}
