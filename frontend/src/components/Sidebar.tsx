import { FilePlus, FolderPlus, RefreshCw, ChevronsDownUp, X } from 'lucide-react'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { FileTree } from './FileTree'

export function Sidebar() {
  const rootName = useFileTreeStore((s) => s.rootName)
  const activeFile = useFileTreeStore((s) => s.activeFile)
  const refreshTree = useFileTreeStore((s) => s.refreshTree)
  const setCreatingEntry = useFileTreeStore((s) => s.setCreatingEntry)
  const closeFolder = useFileTreeStore((s) => s.closeFolder)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)

  const activeFileDir = activeFile ? activeFile.split('/').slice(0, -1).join('/') : ''

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between h-8 px-3 border-b border-border-default bg-bg-surface shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted select-none">
          Explorer
        </span>
        {rootName && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCreatingEntry({ parentPath: activeFileDir, kind: 'file' })}
              className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
              title="New File"
              aria-label="New File"
            >
              <FilePlus size={14} />
            </button>
            <button
              onClick={() => setCreatingEntry({ parentPath: activeFileDir, kind: 'directory' })}
              className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
              title="New Folder"
              aria-label="New Folder"
            >
              <FolderPlus size={14} />
            </button>
            <button
              onClick={() => refreshTree()}
              className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={collapseAll}
              className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
              title="Collapse All"
              aria-label="Collapse All"
            >
              <ChevronsDownUp size={14} />
            </button>
            <button
              onClick={closeFolder}
              className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
              title="Close Folder"
              aria-label="Close Folder"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        <FileTree />
      </div>
    </div>
  )
}
