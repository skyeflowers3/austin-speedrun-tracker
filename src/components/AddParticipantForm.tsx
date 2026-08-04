import { useState } from 'react'
import { createParticipant } from '../services/dataService'
import { Notice } from './Notice'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const GRADES = ['6th grade', '7th grade', '8th grade', 'Multiple kids']

export function AddParticipantForm({ open, onClose, onCreated }: Props) {
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [zip, setZip] = useState('')
  const [grade, setGrade] = useState('')
  const [referralCodeFromLink, setReferralCodeFromLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setParentName('')
    setEmail('')
    setZip('')
    setGrade('')
    setReferralCodeFromLink('')
    setError(null)
  }

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
      resetForm()
      onClose()
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add participant')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mb-6 rounded-lg border border-line bg-surface-elevated p-4"
    >
      <h2 className="mb-1 text-sm font-semibold text-ink">Add participant</h2>
      <p className="mb-4 text-sm text-ink-muted">
        Use this if a signup didn’t come through, or to add someone who registered offline.
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
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white hover:bg-gold-deep disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save to tracker'}
        </button>
        <button
          type="button"
          disabled={saving}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-warm disabled:opacity-50"
          onClick={() => {
            resetForm()
            onClose()
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
