import { useState, useRef, useEffect } from 'react'
import { FolderOpen, Folder, File, ChevronRight, ChevronDown, Info } from 'lucide-react'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

const TREE_DRAG_MIME = 'application/x-implicitcad-tree-entry'

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'escad': case 'scad': return 'text-accent'
    case 'stl': case 'obj': return 'text-success'
    case 'json': case 'yaml': case 'toml': return 'text-warning'
    case 'md': case 'txt': return 'text-ai'
    default: return 'text-text-muted'
  }
}

function InlineInput({ depth, kind, onSubmit, onCancel }: {
  depth: number
  kind: 'file' | 'directory'
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const name = value.trim()
      if (name && !name.includes('/')) onSubmit(name)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div
      className="flex items-center gap-1.5 py-[3px] pr-2"
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <span className="w-3 shrink-0" />
      {kind === 'directory' ? (
        <Folder size={14} className="shrink-0 text-warning" />
      ) : (
        <File size={14} className="shrink-0 text-text-muted" />
      )}
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        placeholder={kind === 'file' ? 'filename.escad' : 'folder name'}
        className="flex-1 min-w-0 text-[13px] bg-bg-raised border border-accent rounded px-1 py-px outline-none text-text-primary placeholder:text-text-faint"
      />
    </div>
  )
}

export function FileTree() {
  const rootName = useFileTreeStore((s) => s.rootName)
  const files = useFileTreeStore((s) => s.files)
  const openFiles = useFileTreeStore((s) => s.openFiles)
  const activeFile = useFileTreeStore((s) => s.activeFile)
  const expandedDirs = useFileTreeStore((s) => s.expandedDirs)
  const openFolder = useFileTreeStore((s) => s.openFolder)
  const openFile = useFileTreeStore((s) => s.openFile)
  const toggleDir = useFileTreeStore((s) => s.toggleDir)
  const creatingEntry = useFileTreeStore((s) => s.creatingEntry)
  const setCreatingEntry = useFileTreeStore((s) => s.setCreatingEntry)
  const createFile = useFileTreeStore((s) => s.createFile)
  const createFolder = useFileTreeStore((s) => s.createFolder)
  const moveEntry = useFileTreeStore((s) => s.moveEntry)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const dirtyPaths = new Set(openFiles.filter((tab) => tab.savedContent !== tab.draftContent).map((tab) => tab.path))
  const openPaths = new Set(openFiles.map((tab) => tab.path))

  if (!rootName) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <FolderOpen size={32} className="text-text-muted" />
        <div className="text-sm font-medium text-text-secondary">No folder open</div>
        <button
          onClick={openFolder}
          className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
        >
          Open Folder
        </button>
        <div className="flex items-center gap-1 text-[11px] text-text-faint mt-1">
          <Info size={10} />
          <span>Requires Chrome or Edge</span>
        </div>
      </div>
    )
  }

  // Filter visible entries
  const visible = files.filter((entry) => {
    if (entry.depth === 0) return true
    const parts = entry.path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const ancestorPath = parts.slice(0, i).join('/')
      if (!expandedDirs.has(ancestorPath)) return false
    }
    return true
  })

  const handleContextMenu = (e: React.MouseEvent, entry: typeof files[0]) => {
    e.preventDefault()
    const items: ContextMenuItem[] = []

    if (entry.kind === 'directory') {
      items.push(
        { label: 'New File', action: () => setCreatingEntry({ parentPath: entry.path, kind: 'file' }) },
        { label: 'New Folder', action: () => setCreatingEntry({ parentPath: entry.path, kind: 'directory' }) },
        { label: 'separator', action: () => {} },
        { label: 'Copy Path', action: () => navigator.clipboard.writeText(entry.path) },
      )
    } else {
      items.push(
        { label: 'Open', action: () => openFile(entry.path) },
        { label: 'separator', action: () => {} },
        { label: 'Copy Path', action: () => navigator.clipboard.writeText(entry.path) },
      )
    }

    setContextMenu({ x: e.clientX, y: e.clientY, items })
  }

  const handleCreate = (name: string) => {
    if (!creatingEntry) return
    if (creatingEntry.kind === 'file') {
      createFile(creatingEntry.parentPath, name)
    } else {
      createFolder(creatingEntry.parentPath, name)
    }
    setCreatingEntry(null)
  }

  const creatingParentPath = creatingEntry?.parentPath ?? ''
  const readDraggedPath = (e: React.DragEvent) =>
    e.dataTransfer.getData(TREE_DRAG_MIME) || e.dataTransfer.getData('text/plain')

  return (
    <div className="flex flex-col h-full">
      {/* Folder name */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wider truncate border-b border-border-default bg-bg-surface shrink-0">
        <FolderOpen size={12} className="text-warning shrink-0" />
        {rootName}
      </div>

      {/* File list */}
      <div
        className={`flex-1 overflow-y-auto py-1 transition-all duration-200 ease-out ${
          dragOverPath === '' ? 'bg-accent-dim/40 shadow-[inset_0_0_16px_var(--color-accent-dim)]' : ''
        }`}
        onDragOver={(e) => {
          if (!draggingPath) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOverPath('')
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          if (dragOverPath === '') setDragOverPath(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOverPath(null)
          setDraggingPath(null)
          const sourcePath = readDraggedPath(e)
          if (sourcePath) moveEntry(sourcePath, '')
        }}
      >
        {creatingEntry && creatingParentPath === '' && (
          <InlineInput
            depth={0}
            kind={creatingEntry.kind}
            onSubmit={handleCreate}
            onCancel={() => setCreatingEntry(null)}
          />
        )}
        {visible.map((entry) => {
          const isDir = entry.kind === 'directory'
          const isExpanded = expandedDirs.has(entry.path)
          const isActive = entry.path === activeFile
          const isOpen = openPaths.has(entry.path)
          const isDirty = dirtyPaths.has(entry.path)

          const isDragOver = dragOverPath === entry.path && isDir

          return (
            <div key={entry.path}>
              <button
                draggable
                onDragStart={(e) => {
                  setDraggingPath(entry.path)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData(TREE_DRAG_MIME, entry.path)
                  e.dataTransfer.setData('text/plain', entry.path)
                }}
                onDragEnd={() => { setDraggingPath(null); setDragOverPath(null) }}
                onDragOver={(e) => {
                  if (!draggingPath || draggingPath === entry.path) return
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  // Highlight the target directory (or the parent dir for files)
                  const targetDir = isDir ? entry.path : entry.path.split('/').slice(0, -1).join('/')
                  if (dragOverPath !== targetDir) setDragOverPath(targetDir)
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                  setDragOverPath(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragOverPath(null)
                  setDraggingPath(null)
                  const sourcePath = readDraggedPath(e)
                  if (!sourcePath) return
                  const targetDir = isDir ? entry.path : entry.path.split('/').slice(0, -1).join('/')
                  moveEntry(sourcePath, targetDir)
                }}
                onClick={() => isDir ? toggleDir(entry.path) : openFile(entry.path)}
                onContextMenu={(e) => handleContextMenu(e, entry)}
                className={`flex items-center gap-1.5 w-full text-left text-[13px] py-1 pr-2 transition-all duration-150 ease-out ${
                  isDragOver ? 'bg-accent-dim/70 shadow-[inset_3px_0_0_var(--color-accent)] scale-[1.01]' :
                  draggingPath === entry.path ? 'opacity-30 scale-[0.97]' :
                  isActive ? 'bg-accent-dim text-accent' : isOpen ? 'text-text-primary hover:bg-bg-hover' : 'text-text-secondary hover:bg-bg-hover'
                }`}
                style={{ paddingLeft: `${12 + entry.depth * 16}px` }}
                title={entry.path}
              >
                {isDir ? (
                  <>
                    {isExpanded ? (
                      <ChevronDown size={12} className="shrink-0 text-text-muted" />
                    ) : (
                      <ChevronRight size={12} className="shrink-0 text-text-muted" />
                    )}
                    {isExpanded ? (
                      <FolderOpen size={14} className="shrink-0 text-warning" />
                    ) : (
                      <Folder size={14} className="shrink-0 text-warning" />
                    )}
                  </>
                ) : (
                  <>
                    <span className="w-3 shrink-0" />
                    <File size={14} className={`shrink-0 ${getFileColor(entry.name)}`} />
                  </>
                )}
                <span className="truncate">{entry.name}</span>
                {(isOpen || isDirty) && (
                  <span className="ml-auto flex items-center gap-1.5 shrink-0">
                    {!isActive && isOpen && (
                      <span className="h-1.5 w-1.5 rounded-full bg-text-faint/70" title="Open in editor tab" />
                    )}
                    {isDirty && (
                      <span className="text-warning" title="Unsaved changes">●</span>
                    )}
                  </span>
                )}
              </button>
              {/* Inline creation input inside this directory */}
              {creatingEntry && isDir && isExpanded && entry.path === creatingParentPath && (
                <InlineInput
                  depth={entry.depth + 1}
                  kind={creatingEntry.kind}
                  onSubmit={handleCreate}
                  onCancel={() => setCreatingEntry(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
