import type { ReactNode } from 'react'

interface Props {
  tone?: 'error' | 'info'
  children: ReactNode
  className?: string
}

export function Notice({ tone = 'info', children, className = '' }: Props) {
  const styles =
    tone === 'error'
      ? 'border-danger/25 bg-danger/10 text-danger'
      : 'border-line bg-surface-warm text-ink-soft'

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles} ${className}`}>{children}</div>
  )
}
