import { newId } from '../lib/id'

export interface ChildDraft {
  key: string
  firstName: string
  grade: string
  dateOfBirth: string
  schoolName: string
  schoolType: string
  studentEmail: string
  accommodations: string
  hasHomeDevice: boolean
}

export const CHILD_GRADES = ['6th', '7th', '8th', '6th grade', '7th grade', '8th grade']
export const SCHOOL_TYPES = ['Public', 'Private', 'Charter', 'Microschool', 'Homeschool']

interface Props {
  value: ChildDraft[]
  onChange: (next: ChildDraft[]) => void
  /** simple = name + grade (quick add). full = all school fields (detail edit). */
  variant?: 'simple' | 'full'
  showLabel?: boolean
  showAddButton?: boolean
}

export function emptyChildDraft(): ChildDraft {
  return {
    key: newId(),
    firstName: '',
    grade: '',
    dateOfBirth: '',
    schoolName: '',
    schoolType: '',
    studentEmail: '',
    accommodations: '',
    hasHomeDevice: false,
  }
}

export function ChildrenEditor({
  value,
  onChange,
  variant = 'simple',
  showLabel = true,
  showAddButton = true,
}: Props) {
  function updateRow(key: string, patch: Partial<ChildDraft>) {
    onChange(value.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const gradesFor = (current: string) =>
    current && !CHILD_GRADES.includes(current) ? [current, ...CHILD_GRADES] : CHILD_GRADES

  const typesFor = (current: string) =>
    current && !SCHOOL_TYPES.includes(current) ? [current, ...SCHOOL_TYPES] : SCHOOL_TYPES

  return (
    <div className="sm:col-span-2">
      {showLabel ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Children</span>
          {showAddButton ? (
            <button
              type="button"
              className="text-sm font-semibold text-blue hover:underline"
              onClick={() => onChange([...value, emptyChildDraft()])}
            >
              + Add child
            </button>
          ) : null}
        </div>
      ) : null}

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-muted">
          No children yet. Add one if you have their info.
        </p>
      ) : (
        <div className="grid gap-3">
          {value.map((row, index) => (
            <div
              key={row.key}
              className="rounded-lg border border-line bg-surface px-3 py-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-soft">
                  Child{value.length > 1 ? ` ${index + 1}` : ''}
                </span>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm font-medium text-danger hover:bg-danger/10"
                  onClick={() => onChange(value.filter((r) => r.key !== row.key))}
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-soft">Name</span>
                  <input
                    value={row.firstName}
                    onChange={(e) => updateRow(row.key, { firstName: e.target.value })}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2"
                    placeholder="Alex"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-ink-soft">Grade</span>
                  <select
                    value={row.grade}
                    onChange={(e) => updateRow(row.key, { grade: e.target.value })}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2"
                  >
                    <option value="">Select…</option>
                    {gradesFor(row.grade).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                {variant === 'full' ? (
                  <>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium text-ink-soft">Date of birth</span>
                      <input
                        type="date"
                        value={row.dateOfBirth}
                        onChange={(e) => updateRow(row.key, { dateOfBirth: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium text-ink-soft">School type</span>
                      <select
                        value={row.schoolType}
                        onChange={(e) => updateRow(row.key, { schoolType: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2"
                      >
                        <option value="">Select…</option>
                        {typesFor(row.schoolType).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-ink-soft">School name</span>
                      <input
                        value={row.schoolName}
                        onChange={(e) => updateRow(row.key, { schoolName: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium text-ink-soft">
                        Student email <span className="font-normal text-ink-muted">(optional)</span>
                      </span>
                      <input
                        type="email"
                        value={row.studentEmail}
                        onChange={(e) => updateRow(row.key, { studentEmail: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium text-ink-soft">
                        Accommodations <span className="font-normal text-ink-muted">(optional)</span>
                      </span>
                      <input
                        value={row.accommodations}
                        onChange={(e) => updateRow(row.key, { accommodations: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2"
                        placeholder="IEP / 504"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={row.hasHomeDevice}
                        onChange={(e) =>
                          updateRow(row.key, { hasHomeDevice: e.target.checked })
                        }
                        className="size-4"
                      />
                      <span className="text-ink-soft">Device + reliable internet at home</span>
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
