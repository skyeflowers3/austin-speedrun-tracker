export interface ChildDraft {
  key: string
  firstName: string
  grade: string
}

export const CHILD_GRADES = ['6th grade', '7th grade', '8th grade']

interface Props {
  value: ChildDraft[]
  onChange: (next: ChildDraft[]) => void
}

export function emptyChildDraft(): ChildDraft {
  return { key: crypto.randomUUID(), firstName: '', grade: '' }
}

export function ChildrenEditor({ value, onChange }: Props) {
  function updateRow(key: string, patch: Partial<ChildDraft>) {
    onChange(value.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Children</span>
        <button
          type="button"
          className="text-sm font-semibold text-blue hover:underline"
          onClick={() => onChange([...value, emptyChildDraft()])}
        >
          + Add child
        </button>
      </div>
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-muted">
          No children yet. Add one if you have their info.
        </p>
      ) : (
        <div className="grid gap-3">
          {value.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-2 rounded-lg border border-line bg-surface px-3 py-3 sm:grid-cols-[1fr_10rem_auto]"
            >
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink-soft">
                  First name{value.length > 1 ? ` (${index + 1})` : ''}
                </span>
                <input
                  value={row.firstName}
                  onChange={(e) => updateRow(row.key, { firstName: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                  placeholder="Alex"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink-soft">Grade</span>
                <select
                  value={row.grade}
                  onChange={(e) => updateRow(row.key, { grade: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                >
                  <option value="">Select…</option>
                  {CHILD_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="rounded-lg px-2 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                  onClick={() => onChange(value.filter((r) => r.key !== row.key))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
