import { useState, useEffect, useCallback, useRef } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import { Files, Plus } from 'lucide-react'
import { Header } from './components/Header'
import { PanelZone } from './components/PanelZone'
import { StatusBar } from './components/StatusBar'
import { CommandPalette } from './components/CommandPalette'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Sidebar } from './components/Sidebar'
import { useEditorStore } from './stores/editorStore'
import { useViewerStore } from './stores/viewerStore'
import { useLayoutStore, type ZoneId } from './stores/layoutStore'
import { useFileTreeStore } from './stores/fileTreeStore'
import { useRender } from './hooks/useRender'

const separatorH = "h-1.5 flex items-center justify-center bg-border-subtle hover:bg-accent transition-colors cursor-row-resize group z-[var(--z-panel)] relative"
const separatorDot = "w-8 h-1 rounded-full bg-border-strong group-hover:bg-white/50 transition-colors"

/* ── Empty zone drop strip ─────────────────────────────────────────── */

function EmptyZoneDropTarget({ zone }: { zone: ZoneId }) {
  const [isOver, setIsOver] = useState(false)
  const isDragging = useLayoutStore((s) => s.isDragging)
  const dragState = useLayoutStore((s) => s.dragState)
  const movePanel = useLayoutStore((s) => s.movePanel)

  return (
    <div
      className={`shrink-0 rounded-lg border-2 flex items-center justify-center gap-2 transition-all duration-200 ${
        isOver
          ? 'h-20 mx-1.5 mb-1 border-solid border-accent bg-accent-dim text-accent shadow-[inset_0_0_24px_var(--color-accent-dim)]'
          : isDragging
            ? 'h-12 mx-1.5 mb-1 border-dashed border-accent/40 bg-accent-dim/50 text-text-muted animate-pulse-accent'
            : 'h-0 border-0 m-0 p-0 overflow-hidden'
      }`}
      onDragOver={(e) => {
        if (!dragState) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsOver(false)
        if (!dragState) return
        movePanel(dragState.panelId, dragState.fromZone, zone)
        useLayoutStore.getState().setDragState(null)
        useLayoutStore.getState().setDragging(false)
      }}
    >
      <Plus size={isOver ? 14 : isDragging ? 12 : 10} className={`shrink-0 transition-all ${
        isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
      }`} />
      <span className={`text-[11px] font-medium select-none pointer-events-none transition-opacity ${
        isDragging ? 'opacity-100' : 'opacity-0'
      }`}>
        {isOver ? 'Release to create panel' : 'Drop here to split'}
      </span>
    </div>
  )
}

/* ── Confirm dialog wrapper ────────────────────────────────────────── */

function ConfirmDialogWrapper() {
  const pendingAction = useFileTreeStore((s) => s.pendingAction)
  const confirmDiscardPending = useFileTreeStore((s) => s.confirmDiscardPending)
  const confirmSavePending = useFileTreeStore((s) => s.confirmSavePending)
  const cancelPending = useFileTreeStore((s) => s.cancelPending)

  if (!pendingAction) return null

  const isCloseFolder = pendingAction.type === 'close-folder'
  const message = isCloseFolder
    ? 'You have unsaved files. Close folder anyway?'
    : `"${pendingAction.path.split('/').pop()}" has unsaved changes. What would you like to do before closing it?`

  return (
    <ConfirmDialog
      title="Unsaved Changes"
      message={message}
      confirmLabel="Discard"
      saveLabel={isCloseFolder ? 'Save All & Close' : 'Save & Close'}
      onConfirm={confirmDiscardPending}
      onSave={confirmSavePending}
      onCancel={cancelPending}
    />
  )
}

/* ── Small viewport fallback ──────────────────────────────────────── */

function SmallViewportFallback() {
  const [tooSmall, setTooSmall] = useState(false)

  useEffect(() => {
    const check = () => setTooSmall(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!tooSmall) return null

  return (
    <div className="fixed inset-0 z-[var(--z-viewport-block)] bg-bg-base flex flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-sm tracking-tight">
        IC
      </div>
      <div className="text-base font-semibold text-text-primary">
        Implicit<span className="text-accent">CAD</span> Studio
      </div>
      <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
        ImplicitCAD Studio is designed for desktop browsers. Please use a window at least 768px wide.
      </p>
    </div>
  )
}

/* ── App ───────────────────────────────────────────────────────────── */

export default function App() {
  const code = useEditorStore((s) => s.code)
  const log = useEditorStore((s) => s.log)
  const setBackendMode = useViewerStore((s) => s.setBackendMode)
  const { render, scheduleRender } = useRender()

  const rootName = useFileTreeStore((s) => s.rootName)
  const activeFile = useFileTreeStore((s) => s.activeFile)
  const isDirty = useFileTreeStore((s) => s.isDirty)
  const sidebarOpen = useFileTreeStore((s) => s.sidebarOpen)
  const toggleSidebar = useFileTreeStore((s) => s.toggleSidebar)

  const leftTopEmpty = useLayoutStore((s) => s.zones.topLeft.length === 0)
  const leftBottomEmpty = useLayoutStore((s) => s.zones.bottomLeft.length === 0)
  const rightTopEmpty = useLayoutStore((s) => s.zones.topRight.length === 0)
  const rightBottomEmpty = useLayoutStore((s) => s.zones.bottomRight.length === 0)

  const handleRender = useCallback(() => {
    render(code)
  }, [render, code])

  const handleCodeChange = useCallback(
    (newCode: string) => {
      scheduleRender(newCode)
    },
    [scheduleRender],
  )

  const handleOpenFolder = useCallback(async () => {
    await useFileTreeStore.getState().openFolder()
  }, [])

  const handleExplorerClick = useCallback(() => {
    toggleSidebar()
  }, [toggleSidebar])

  const initialRenderDone = useRef(false)

  useEffect(() => {
    async function detectBackend() {
      try {
        const r = await fetch('/render/?source=sphere(1);&callback=__test&format=jsTHREE', {
          signal: AbortSignal.timeout(3000),
        })
        if (r.ok) {
          setBackendMode('implicitsnap')
          log('Connected to implicitsnap (port 8080)', 'success')
          if (!initialRenderDone.current) {
            initialRenderDone.current = true
            setTimeout(() => render(useEditorStore.getState().code), 500)
          }
          return
        }
      } catch {
        // Expected timeout when implicitsnap is not running
      }

      try {
        const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
        if (r.ok) {
          setBackendMode('docker')
          log('Connected to Docker backend', 'success')
          if (!initialRenderDone.current) {
            initialRenderDone.current = true
            setTimeout(() => render(useEditorStore.getState().code), 500)
          }
          return
        }
      } catch {
        // Expected timeout when Docker backend is not running
      }

      setBackendMode('docker')
      log('No backend detected. Start Docker or implicitsnap.', 'warning')
    }

    detectBackend()
  }, [setBackendMode, log, render])

  useEffect(() => {
    const baseTitle = 'ImplicitCAD Studio'
    if (!activeFile) {
      document.title = baseTitle
      return
    }

    const fileName = activeFile.split('/').pop()
    document.title = `${isDirty ? '* ' : ''}${fileName} - ${baseTitle}`
  }, [activeFile, isDirty])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleRender()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (useFileTreeStore.getState().activeFileHandle) {
          useFileTreeStore.getState().saveFile()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        useEditorStore.getState().setCommandPaletteOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        useFileTreeStore.getState().toggleSidebar()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleRender])

  return (
    <>
    <SmallViewportFallback />
    <div className="flex flex-col h-screen bg-bg-base text-text-primary">
      <Header onRender={handleRender} onOpenFolder={handleOpenFolder} />

      <div className="flex flex-1 min-h-0">
        {/* Activity Bar */}
        <div className="w-9 shrink-0 bg-bg-surface border-r border-border-default flex flex-col items-center pt-2">
          <button
            onClick={handleExplorerClick}
            className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
              sidebarOpen
                ? 'bg-bg-hover text-text-primary border-l-2 border-accent'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
            }`}
            title={rootName ? 'Toggle Explorer (Cmd/Ctrl+B)' : 'Show Explorer (Cmd/Ctrl+B)'}
            aria-label="Toggle Explorer"
          >
            <Files size={18} />
          </button>
        </div>

        {/* Inline sidebar — pushes content, no overlay */}
        {sidebarOpen && (
          <div className="w-60 shrink-0 border-r border-border-default bg-bg-base overflow-hidden">
            <Sidebar />
          </div>
        )}

        {/* Main content */}
        <Group orientation="horizontal" className="flex-1 min-w-0">
          {/* Left column */}
          <Panel defaultSize={40} minSize={20}>
            {leftTopEmpty ? (
              <div className="flex flex-col h-full">
                <EmptyZoneDropTarget zone="topLeft" />
                <div className="flex-1 min-h-0">
                  <PanelZone zone="bottomLeft" onRender={handleRender} onCodeChange={handleCodeChange} />
                </div>
              </div>
            ) : leftBottomEmpty ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0">
                  <PanelZone zone="topLeft" onRender={handleRender} onCodeChange={handleCodeChange} />
                </div>
                <EmptyZoneDropTarget zone="bottomLeft" />
              </div>
            ) : (
              <Group orientation="vertical">
                <Panel defaultSize={65} minSize={20}>
                  <PanelZone zone="topLeft" onRender={handleRender} onCodeChange={handleCodeChange} />
                </Panel>
                <Separator className={separatorH}><div className={separatorDot} /></Separator>
                <Panel defaultSize={35} minSize={15}>
                  <PanelZone zone="bottomLeft" onRender={handleRender} onCodeChange={handleCodeChange} />
                </Panel>
              </Group>
            )}
          </Panel>

          <Separator className="w-1.5 flex flex-col items-center justify-center bg-border-subtle hover:bg-accent transition-colors cursor-col-resize group z-[var(--z-panel)] relative"><div className="h-8 w-1 rounded-full bg-border-strong group-hover:bg-white/50 transition-colors" /></Separator>

          {/* Right column */}
          <Panel defaultSize={50} minSize={30}>
            {rightTopEmpty ? (
              <div className="flex flex-col h-full">
                <EmptyZoneDropTarget zone="topRight" />
                <div className="flex-1 min-h-0">
                  <PanelZone zone="bottomRight" onRender={handleRender} onCodeChange={handleCodeChange} />
                </div>
              </div>
            ) : rightBottomEmpty ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 min-h-0">
                  <PanelZone zone="topRight" onRender={handleRender} onCodeChange={handleCodeChange} />
                </div>
                <EmptyZoneDropTarget zone="bottomRight" />
              </div>
            ) : (
              <Group orientation="vertical">
                <Panel defaultSize={50} minSize={20}>
                  <PanelZone zone="topRight" onRender={handleRender} onCodeChange={handleCodeChange} />
                </Panel>
                <Separator className={separatorH}><div className={separatorDot} /></Separator>
                <Panel defaultSize={50} minSize={15}>
                  <PanelZone zone="bottomRight" onRender={handleRender} onCodeChange={handleCodeChange} />
                </Panel>
              </Group>
            )}
          </Panel>
        </Group>
      </div>

      <StatusBar />
      <CommandPalette onRender={handleRender} />
      <ConfirmDialogWrapper />
    </div>
    </>
  )
}
