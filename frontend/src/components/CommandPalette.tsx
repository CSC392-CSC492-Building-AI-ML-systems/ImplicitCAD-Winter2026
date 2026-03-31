import { useState, useEffect, useRef, useMemo } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useViewerStore } from '../stores/viewerStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useChatStore } from '../stores/chatStore'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { EXAMPLES } from '../lib/examples'
import { downloadBlob } from '../lib/download'

interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  onRender: () => void
}

export function CommandPalette({ onRender }: CommandPaletteProps) {
  const open = useEditorStore((s) => s.commandPaletteOpen)
  const close = () => useEditorStore.getState().setCommandPaletteOpen(false)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Command[]>(() => {
    const log = useEditorStore.getState().log
    return [
      { id: 'render', label: 'Render', shortcut: '⌘↵', action: () => onRender() },
      {
        id: 'toggle-theme', label: 'Toggle Theme', action: () => {
          const s = useEditorStore.getState()
          s.setIsDark(!s.isDark)
        }
      },
      {
        id: 'toggle-autorender', label: 'Toggle Auto-render', action: () => {
          const s = useEditorStore.getState()
          s.setAutoRender(!s.autoRender)
        }
      },
      { id: 'reset-layout', label: 'Reset Layout', action: () => useLayoutStore.getState().resetLayout() },
      { id: 'toggle-grid', label: 'Toggle All Grids', action: () => {
          const s = useViewerStore.getState()
          const anyOn = s.gridXY || s.gridXZ || s.gridYZ
          if (anyOn) {
            if (s.gridXY) s.toggleGridXY()
            if (s.gridXZ) s.toggleGridXZ()
            if (s.gridYZ) s.toggleGridYZ()
          } else {
            s.toggleGridXY()
          }
        }
      },
      { id: 'toggle-grid-xy', label: 'Toggle Grid XY', action: () => useViewerStore.getState().toggleGridXY() },
      { id: 'toggle-grid-xz', label: 'Toggle Grid XZ', action: () => useViewerStore.getState().toggleGridXZ() },
      { id: 'toggle-grid-yz', label: 'Toggle Grid YZ', action: () => useViewerStore.getState().toggleGridYZ() },
      { id: 'toggle-wireframe', label: 'Toggle Wireframe', action: () => useViewerStore.getState().toggleWireframe() },
      { id: 'reset-camera', label: 'Reset Camera', action: () => useViewerStore.getState().setCameraPreset('reset') },
      { id: 'view-front', label: 'Front View', action: () => useViewerStore.getState().setCameraPreset('front') },
      { id: 'view-top', label: 'Top View', action: () => useViewerStore.getState().setCameraPreset('top') },
      { id: 'view-iso', label: 'Isometric View', action: () => useViewerStore.getState().setCameraPreset('iso') },
      {
        id: 'export-stl', label: 'Export STL', action: () => {
          const blob = useViewerStore.getState().lastStlBlob
          if (blob) {
            downloadBlob(blob, 'model.stl')
            log('Downloaded STL', 'success')
          } else {
            log('No model to export', 'warning')
          }
        }
      },
      {
        id: 'screenshot', label: 'Screenshot Viewport', action: () => {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
          if (!canvas) return
          const a = document.createElement('a')
          a.href = canvas.toDataURL('image/png')
          a.download = 'viewport.png'
          a.click()
          log('Viewport screenshot saved', 'success')
        }
      },
      { id: 'open-folder', label: 'Open Folder', action: () => {
        useFileTreeStore.getState().openFolder()
      }},
      { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: '⌘B', action: () => useFileTreeStore.getState().toggleSidebar() },
      { id: 'save-file', label: 'Save File', shortcut: '⌘S', action: () => useFileTreeStore.getState().saveFile() },
      { id: 'clear-chat', label: 'Clear Chat', action: () => useChatStore.getState().clear() },
      { id: 'clear-output', label: 'Clear Output', action: () => useEditorStore.getState().clearLogs() },
      ...EXAMPLES.map((ex) => ({
        id: `example-${ex.name}`,
        label: `Example: ${ex.name}`,
        action: () => useEditorStore.getState().setCode(ex.code),
      })),
      {
        id: 'toggle-compat', label: 'Toggle OpenSCAD Compat', action: () => {
          const s = useViewerStore.getState()
          s.setCompatMode(!s.compatMode)
        }
      },
    ]
  }, [onRender])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [query, commands])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selected] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selected]) {
        filtered[selected].action()
        close()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="max-w-md w-full mx-auto mt-[15vh] bg-bg-base border border-border-default shadow-xl rounded-xl overflow-hidden animate-palette-in"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Command palette"
          placeholder="Type a command..."
          className="h-12 w-full px-4 text-sm bg-bg-base border-b border-border-default outline-none text-text-primary placeholder:text-text-muted"
        />
        <div ref={listRef} role="listbox" className="max-h-[min(400px,60vh)] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-text-muted text-center">No commands found</div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                role="option"
                aria-selected={i === selected}
                onClick={() => { cmd.action(); close() }}
                onMouseEnter={() => setSelected(i)}
                className={`px-4 py-2.5 flex items-center gap-3 text-sm w-full text-left transition-colors ${
                  i === selected ? 'bg-bg-hover text-text-primary' : 'text-text-secondary'
                }`}
              >
                <span className="flex-1">{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="text-[10px] font-mono bg-bg-raised px-1.5 py-0.5 rounded text-text-muted">
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
