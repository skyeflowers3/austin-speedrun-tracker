interface Props {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-surface-elevated p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[11px] tracking-widest text-gold-deep uppercase">Confirm</p>
        <h2 id="confirm-title" className="mt-1 font-display text-xl font-semibold text-navy">
          {title}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{body}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-surface-warm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white hover:bg-danger/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
