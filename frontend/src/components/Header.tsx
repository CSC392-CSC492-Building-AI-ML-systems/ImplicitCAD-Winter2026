import { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Menu, FolderOpen, Sun, Moon } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { useViewerStore } from '../stores/viewerStore'
import { EXAMPLES } from '../lib/examples'

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const shortcut = isMac ? '⌘↵' : 'Ctrl+↵'

interface HeaderProps {
  onRender: () => void
  onOpenFolder?: () => void
}

export function Header({ onRender, onOpenFolder }: HeaderProps) {
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [exampleFocusIndex, setExampleFocusIndex] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const autoRender = useEditorStore((s) => s.autoRender)
  const setAutoRender = useEditorStore((s) => s.setAutoRender)
  const setCode = useEditorStore((s) => s.setCode)
  const isDark = useEditorStore((s) => s.isDark)
  const setIsDark = useEditorStore((s) => s.setIsDark)
  const isRendering = useViewerStore((s) => s.isRendering)
  const backendMode = useViewerStore((s) => s.backendMode)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExamplesOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // Keyboard navigation for examples dropdown
  const handleDropdownKeyDown = useCallback((e: KeyboardEvent) => {
    if (!examplesOpen) return
    if (e.key === 'Escape') {
      setExamplesOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setExampleFocusIndex((i) => Math.min(i + 1, EXAMPLES.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setExampleFocusIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      setCode(EXAMPLES[exampleFocusIndex].code)
      setExamplesOpen(false)
    }
  }, [examplesOpen, exampleFocusIndex, setCode])

  useEffect(() => {
    document.addEventListener('keydown', handleDropdownKeyDown)
    return () => document.removeEventListener('keydown', handleDropdownKeyDown)
  }, [handleDropdownKeyDown])

  // Focus active item when index changes
  useEffect(() => {
    if (!examplesOpen) return
    const items = dropdownRef.current?.querySelectorAll('[role="menuitem"]')
    if (items && items[exampleFocusIndex]) {
      (items[exampleFocusIndex] as HTMLElement).focus()
    }
  }, [exampleFocusIndex, examplesOpen])

  const statusColor = isRendering
    ? 'bg-warning animate-pulse'
    : backendMode
      ? 'bg-success shadow-[0_0_6px_var(--color-success)]'
      : 'bg-error'

  const statusText = isRendering
    ? 'Rendering...'
    : backendMode === 'implicitsnap'
      ? 'implicitsnap'
      : backendMode === 'docker'
        ? 'Docker backend'
        : 'Connecting...'

  const toggleTheme = () => setIsDark(!isDark)

  return (
    <header className="flex items-center justify-between h-[3.125rem] px-5 bg-bg-base border-b border-border-default shrink-0 z-[var(--z-header)]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center text-white font-bold text-[10px] tracking-tight">
          IC
        </div>
        <div className="font-semibold text-[15px] tracking-tight text-text-primary">
          Implicit<span className="text-accent">CAD</span> Studio
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-[7px] text-xs font-medium text-text-secondary px-3 py-[5px] bg-bg-raised rounded-full border border-border-default">
          <span className={`w-[7px] h-[7px] rounded-full ${statusColor}`} aria-label={statusText} />
          <span aria-live="polite">{statusText}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="p-1.5 text-text-secondary hover:text-text-primary rounded-md transition-colors" aria-label="Toggle dark mode">
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {onOpenFolder && (
          <button onClick={onOpenFolder} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-base border border-border-default rounded-md hover:bg-bg-raised hover:text-text-primary transition-all">
            <FolderOpen size={14} /> Open Folder
          </button>
        )}

        <label className="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer select-none">
          <input type="checkbox" checked={autoRender} onChange={(e) => setAutoRender(e.target.checked)} className="accent-accent" aria-label="Auto-render on code change" />
          Auto-render
        </label>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExamplesOpen((open) => {
                const next = !open
                if (next) setExampleFocusIndex(0)
                return next
              })
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-base border border-border-default rounded-md hover:bg-bg-raised hover:text-text-primary transition-all"
            aria-haspopup="true"
            aria-expanded={examplesOpen}
          >
            <Menu size={14} /> Examples
          </button>
          {examplesOpen && (
            <div className="absolute top-full right-0 mt-1 w-72 bg-bg-base border border-border-default rounded-xl shadow-lg z-[var(--z-dropdown)] overflow-hidden animate-drop-in" role="menu">
              <div className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-text-muted border-b border-border-default">
                Load Example
              </div>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={ex.name}
                  role="menuitem"
                  tabIndex={i === exampleFocusIndex ? 0 : -1}
                  className={`block w-full px-3.5 py-2.5 text-left text-sm transition-all outline-none ${
                    i === exampleFocusIndex
                      ? 'bg-bg-raised text-text-primary'
                      : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'
                  }`}
                  onClick={() => { setCode(ex.code); setExamplesOpen(false) }}
                >
                  {ex.name}
                  <div className="text-[11px] text-text-muted mt-0.5">{ex.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onRender}
          disabled={isRendering}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent border-accent text-white font-semibold text-xs rounded-md hover:bg-accent-hover hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Render current code"
        >
          <Play size={13} fill="white" /> Render
          <kbd className="px-1 py-px bg-white/20 rounded text-[10px] font-mono">{shortcut}</kbd>
        </button>
      </div>
    </header>
  )
}
