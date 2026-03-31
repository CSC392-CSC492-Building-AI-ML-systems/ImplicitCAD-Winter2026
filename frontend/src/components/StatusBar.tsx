import { Loader2 } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { useViewerStore } from '../stores/viewerStore'
import { useFileTreeStore } from '../stores/fileTreeStore'

export function StatusBar() {
  const cursorLine = useEditorStore((s) => s.cursorLine)
  const cursorColumn = useEditorStore((s) => s.cursorColumn)
  const errors = useEditorStore((s) => s.errors)
  const isRendering = useViewerStore((s) => s.isRendering)
  const backendMode = useViewerStore((s) => s.backendMode)
  const modelInfo = useViewerStore((s) => s.modelInfo)
  const rootName = useFileTreeStore((s) => s.rootName)
  const openFiles = useFileTreeStore((s) => s.openFiles)
  const activeFile = useFileTreeStore((s) => s.activeFile)
  const isDirty = useFileTreeStore((s) => s.isDirty)

  return (
    <div className="min-h-[1.375rem] py-0.5 flex items-center justify-between bg-bg-surface border-t border-border-default text-[11px] font-mono text-text-muted px-3 shrink-0 z-[var(--z-statusbar)]">
      {/* Left */}
      <div className="flex items-center gap-3">
        <span className="px-1.5 py-0.5 bg-bg-raised rounded text-text-secondary font-semibold">ImplicitCAD</span>
        {activeFile && (
          <span className="text-text-secondary font-medium truncate max-w-[280px] flex items-center gap-1" title={activeFile}>
            {rootName ? `${rootName}/` : ''}{activeFile}
            {isDirty && <span className="text-warning" title="Unsaved changes">●</span>}
          </span>
        )}
        {openFiles.length > 0 && <span>{openFiles.length} tab{openFiles.length > 1 ? 's' : ''}</span>}
        <span>Ln {cursorLine}, Col {cursorColumn}</span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-1.5" role="status" aria-live="polite">
        {isRendering ? (
          <>
            <Loader2 size={11} className="animate-spin text-accent" />
            <span className="text-text-secondary">Rendering...</span>
          </>
        ) : errors.length > 0 ? (
          <span className="text-error font-medium">{errors.length} error{errors.length > 1 ? 's' : ''}</span>
        ) : modelInfo ? (
          <span className="text-text-secondary">{modelInfo.faces.toLocaleString()} faces</span>
        ) : null}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {backendMode && (
          <span className="px-1.5 py-0.5 bg-bg-raised rounded text-text-secondary">
            Docker
          </span>
        )}
      </div>
    </div>
  )
}
