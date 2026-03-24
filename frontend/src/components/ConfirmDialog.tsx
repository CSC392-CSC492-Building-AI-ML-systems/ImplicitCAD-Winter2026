import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  saveLabel?: string
  onConfirm: () => void
  onSave?: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel = 'Discard', saveLabel, onConfirm, onSave, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  // Focus trap
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const focusable = e.currentTarget.querySelectorAll<HTMLElement>('button')
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-black/30 backdrop-blur-sm flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm bg-bg-base border border-border-default shadow-xl rounded-xl overflow-hidden animate-palette-in"
        onKeyDown={handleKeyDown}
      >
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-base border border-border-default rounded-md hover:bg-bg-raised hover:text-text-primary transition-all"
          >
            Cancel
          </button>
          {onSave && saveLabel && (
            <button
              onClick={onSave}
              className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-all"
            >
              {saveLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-medium bg-error text-white rounded-md hover:brightness-110 transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
