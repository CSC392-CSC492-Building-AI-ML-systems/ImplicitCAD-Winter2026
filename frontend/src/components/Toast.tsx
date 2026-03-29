import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useEditorStore, type Toast as ToastType } from '../stores/editorStore'

const levelStyles = {
  error: 'bg-error/95 text-white',
  warning: 'bg-warning/95 text-white',
  success: 'bg-success/95 text-white',
  info: 'bg-bg-raised text-text-primary border border-border-default',
} as const

function ToastItem({ toast }: { toast: ToastType }) {
  const dismiss = useEditorStore((s) => s.dismissToast)
  const duration = toast.level === 'error' || toast.level === 'warning' ? 8000 : 5000

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.count, dismiss, duration])

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg shadow-lg text-xs font-medium max-w-xs animate-slide-in-right ${levelStyles[toast.level]}`}
      role="alert"
    >
      <span className="flex-1 leading-relaxed">
        {toast.message}
        {toast.count > 1 && (
          <span className="ml-1.5 opacity-70">({toast.count})</span>
        )}
      </span>
      <button
        onClick={() => dismiss(toast.id)}
        className="shrink-0 p-0.5 rounded opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useEditorStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-12 right-4 z-[var(--z-modal)] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  )
}
