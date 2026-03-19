import { useChatStore } from '../stores/chatStore'
import { useEditorStore } from '../stores/editorStore'
import { useLayoutStore, type ZoneId } from '../stores/layoutStore'
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
          <div className={`absolute inset-0 z-20 pointer-events-none transition-opacity ${
            active === 'viewer' ? 'bg-bg-base/50' : 'bg-bg-base/40 backdrop-blur-[2px]'
          }`} />
        )}
      </div>
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
      return (
        <div className="relative h-full overflow-hidden">
          <STLViewer />
          <ViewerToolbar />
        </div>
      )
    case 'output':
      return <OutputConsole />
    default:
      return null
  }
}
