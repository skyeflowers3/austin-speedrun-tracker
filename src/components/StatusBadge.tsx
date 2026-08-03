import type { ParticipantStatus } from '../types'

const STYLES: Record<ParticipantStatus, string> = {
  waitlisted: 'bg-surface-warm text-ink-soft',
  registered: 'bg-blue/10 text-blue',
  enrolled: 'bg-success/10 text-success',
  declined: 'bg-danger/10 text-danger',
}

export function StatusBadge({ status }: { status: ParticipantStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${STYLES[status]}`}
    >
      {status}
    </span>
  )
}
