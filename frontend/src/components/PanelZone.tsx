import { useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useEditorStore } from '../stores/editorStore'
import { useViewerStore } from '../stores/viewerStore'
import { useLayoutStore, type ZoneId } from '../stores/layoutStore'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { TabBar } from './TabBar'
import { CodeEditor } from './CodeEditor'
import { ReferencePanel } from './ReferencePanel'
import { ChatPanel } from './ChatPanel'
import { STLViewer } from './STLViewer'
import { ViewerToolbar } from './ViewerToolbar'
import { OutputConsole } from './OutputConsole'

interface PanelZoneProps {
  zone: ZoneId
  onRender: () => void
  onCodeChange: (code: string) => void
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 text-[11px] font-medium text-text-muted hover:text-text-primary rounded transition-colors"
    >
      Clear
    </button>
  )
}

export function PanelZone({ zone, onRender, onCodeChange }: PanelZoneProps) {
  const active = useLayoutStore((s) => s.activeTab[zone])
  const isDragging = useLayoutStore((s) => s.isDragging)

  const actions = (() => {
    switch (active) {
      case 'chat':
        return <ClearButton onClick={() => useChatStore.getState().clear()} />
      case 'output':
        return <ClearButton onClick={() => useEditorStore.getState().clearLogs()} />
      default:
        return undefined
    }
  })()

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-hidden">
      <TabBar zone={zone} actions={actions} />
      <div className="flex-1 overflow-hidden relative">
        <PanelContent panelId={active} onRender={onRender} onCodeChange={onCodeChange} />
        {isDragging && (
          <div className={`absolute inset-0 z-[var(--z-panel-overlay)] pointer-events-none transition-opacity ${
            active === 'viewer' ? 'bg-bg-base/50' : 'bg-bg-base/40 backdrop-blur-[2px]'
          }`} />
        )}
      </div>
    </div>
  )
}

/** Sync model name with active editor file */
function ModelNameSync() {
  const activeFile = useFileTreeStore((s) => s.activeFile)
  const setModelName = useViewerStore((s) => s.setModelName)

  useEffect(() => {
    if (!activeFile) {
      setModelName('model')
      return
    }
    const ext = activeFile.split('.').pop()?.toLowerCase()
    if (ext === 'scad' || ext === 'escad') {
      const base = activeFile.split('/').pop()?.replace(/\.(scad|escad)$/i, '') || 'model'
      setModelName(base)
    }
    // Non-SCAD files don't update model name
  }, [activeFile, setModelName])

  return null
}

/** Check if active file is a SCAD file */
function useIsScadFile(): boolean {
  const activeFile = useFileTreeStore((s) => s.activeFile)
  if (!activeFile) return true // scratch buffer is SCAD
  const ext = activeFile.split('.').pop()?.toLowerCase()
  return ext === 'scad' || ext === 'escad'
}

function ViewerPanel({ onRender }: { onRender: () => void }) {
  const modelName = useViewerStore((s) => s.modelName)
  const setModelName = useViewerStore((s) => s.setModelName)
  const isScad = useIsScadFile()

  return (
    <div className="relative h-full flex flex-col">
      {/* Filename bar */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border-default bg-bg-surface shrink-0">
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value.replace(/[^a-zA-Z0-9_\-. ]/g, ''))}
          className="w-32 px-1.5 py-0.5 bg-bg-base border border-border-default rounded text-[10px] font-mono text-text-primary outline-none focus-visible:border-accent"
          title="Output filename"
        />
        <span className="text-[10px] text-text-muted font-mono">.stl</span>
      </div>

      {/* 3D Viewer */}
      <div className="flex-1 relative min-h-0">
        <STLViewer />
        {isScad ? (
          <ViewerToolbar onRerender={onRender} />
        ) : (
          <div className="absolute inset-0 z-[var(--z-panel-overlay)] bg-bg-base/60 backdrop-blur-md flex flex-col items-center justify-center gap-2 text-text-muted">
            <div className="text-sm font-medium text-text-primary">Preview unavailable</div>
            <div className="text-[11px]">Open a .scad file to render 3D models</div>
          </div>
        )}
      </div>

      <ModelNameSync />
    </div>
  )
}

function PanelContent({
  panelId,
  onRender,
  onCodeChange,
}: {
  panelId: string
  onRender: () => void
  onCodeChange: (code: string) => void
}) {
  switch (panelId) {
    case 'code':
      return <CodeEditor onRender={onRender} onCodeChange={onCodeChange} />
    case 'ref':
      return <ReferencePanel />
    case 'chat':
      return <ChatPanel />
    case 'viewer':
      return <ViewerPanel onRender={onRender} />
    case 'output':
      return <OutputConsole />
    default:
      return null
  }
}
