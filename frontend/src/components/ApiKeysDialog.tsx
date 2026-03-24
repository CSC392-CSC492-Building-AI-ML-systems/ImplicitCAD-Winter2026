import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useChatStore } from '../stores/chatStore'

interface ApiKeysDialogProps {
  onClose: () => void
}

export function ApiKeysDialog({ onClose }: ApiKeysDialogProps) {
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [showOpenai, setShowOpenai] = useState(false)
  const [showAnthropic, setShowAnthropic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const providerStatus = useChatStore((s) => s.providerStatus)
  const fetchProviderStatus = useChatStore((s) => s.fetchProviderStatus)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Focus trap
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      )
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

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const body: Record<string, string> = {}
      if (openaiKey) body.openaiKey = openaiKey
      if (anthropicKey) body.anthropicKey = anthropicKey

      if (!openaiKey && !anthropicKey) {
        onClose()
        return
      }

      const resp = await fetch('/api/providers/keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error || 'Failed to save')
      }

      await fetchProviderStatus()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save keys')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-black/30 backdrop-blur-sm flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="API Keys"
        className="w-full max-w-md bg-bg-base border border-border-default shadow-xl rounded-xl overflow-hidden animate-palette-in"
        onKeyDown={handleKeyDown}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-ai-dim flex items-center justify-center">
              <KeyRound size={16} className="text-ai" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">API Keys</h2>
          </div>
          <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
            Keys are stored in server memory only — they are not persisted to disk and will reset when the server restarts.
          </p>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-4">
          {/* OpenAI */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="openai-key" className="text-xs font-medium text-text-secondary">
                OpenAI API Key
              </label>
              {providerStatus?.openaiKeySet && (
                <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="openai-key"
                type={showOpenai ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={providerStatus?.openaiKeySet ? 'sk-•••••••• (already set)' : 'sk-...'}
                spellCheck={false}
                autoComplete="off"
                className="w-full px-3 py-2 pr-9 bg-bg-surface border border-border-default rounded-lg text-xs font-mono text-text-primary placeholder:text-text-faint outline-none transition-all focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-dim"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowOpenai(!showOpenai)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              >
                {showOpenai ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Anthropic */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="anthropic-key" className="text-xs font-medium text-text-secondary">
                Anthropic API Key
              </label>
              {providerStatus?.anthropicKeySet && (
                <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="anthropic-key"
                type={showAnthropic ? 'text' : 'password'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder={providerStatus?.anthropicKeySet ? 'sk-ant-•••••••• (already set)' : 'sk-ant-...'}
                spellCheck={false}
                autoComplete="off"
                className="w-full px-3 py-2 pr-9 bg-bg-surface border border-border-default rounded-lg text-xs font-mono text-text-primary placeholder:text-text-faint outline-none transition-all focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-dim"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowAnthropic(!showAnthropic)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              >
                {showAnthropic ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-error">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-default bg-bg-surface/50">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-base border border-border-default rounded-md hover:bg-bg-raised hover:text-text-primary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>
  )
}
