import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Code2, BookOpen, MessageSquare, Box, Terminal, GripVertical } from 'lucide-react'
import { useLayoutStore, type PanelId, type ZoneId } from '../stores/layoutStore'
import { useFileTreeStore } from '../stores/fileTreeStore'

const PANEL_META: Record<PanelId, { icon: typeof Code2; label: string }> = {
  code: { icon: Code2, label: 'Code' },
  ref: { icon: BookOpen, label: 'Reference' },
  chat: { icon: MessageSquare, label: 'AI Chat' },
  viewer: { icon: Box, label: 'Viewer' },
  output: { icon: Terminal, label: 'Output' },
}

interface TabBarProps {
  zone: ZoneId
  actions?: ReactNode
}

const DRAG_TIP_KEY = 'implicitcad-drag-tip-dismissed'

export function TabBar({ zone, actions }: TabBarProps) {
  const panels = useLayoutStore((s) => s.zones[zone])
  const active = useLayoutStore((s) => s.activeTab[zone])
  const movePanel = useLayoutStore((s) => s.movePanel)
  const setActiveTab = useLayoutStore((s) => s.setActiveTab)
  const globalDragging = useLayoutStore((s) => s.isDragging)
  const dragState = useLayoutStore((s) => s.dragState)
  const setDragState = useLayoutStore((s) => s.setDragState)
  const activeFile = useFileTreeStore((s) => s.activeFile)
  const isDirty = useFileTreeStore((s) => s.isDirty)

  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggingPanel, setDraggingPanel] = useState<PanelId | null>(null)
  const [showDragTip, setShowDragTip] = useState(
    () => zone === 'topLeft' && !localStorage.getItem(DRAG_TIP_KEY)
  )
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeFileName = activeFile?.split('/').pop() ?? 'Scratch'

  // First-visit drag tooltip (only for topLeft zone)
  useEffect(() => {
    if (!showDragTip) return
    const timer = setTimeout(() => {
      setShowDragTip(false)
      localStorage.setItem(DRAG_TIP_KEY, '1')
    }, 5000)
    return () => clearTimeout(timer)
  }, [showDragTip])

  const handleDragStart = (e: React.DragEvent, panelId: PanelId) => {
    setDragState({ panelId, fromZone: zone })
    setDraggingPanel(panelId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-panel', panelId)
    useLayoutStore.getState().setDragging(true)
  }

  const handleDragEnd = () => {
    setDraggingPanel(null)
    setDragState(null)
    useLayoutStore.getState().setDragging(false)
  }

  const calcInsertIndex = (clientX: number): number => {
    for (let i = 0; i < tabRefs.current.length; i++) {
      const rect = tabRefs.current[i]?.getBoundingClientRect()
      if (rect && clientX < rect.left + rect.width / 2) return i
    }
    return panels.length
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!dragState) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!isDragOver) setIsDragOver(true)
    const newIdx = calcInsertIndex(e.clientX)
    if (dropIndex !== newIdx) setDropIndex(newIdx)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if we actually left the tab bar (not just entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
    setDropIndex(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDropIndex(null)
    if (!dragState) return
    const idx = calcInsertIndex(e.clientX)
    movePanel(dragState.panelId, dragState.fromZone, zone, idx)
    setDragState(null)
    useLayoutStore.getState().setDragging(false)
  }

  return (
    <div
      className={`relative flex items-center h-8 bg-bg-surface border-b shrink-0 px-1 transition-all ${
        isDragOver
          ? 'bg-accent-dim border-accent'
          : globalDragging
            ? 'border-accent/30 bg-accent-dim/50'
            : 'border-border-default'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center h-full relative" role="tablist">
        {panels.map((panelId, i) => {
          const meta = PANEL_META[panelId]
          const Icon = meta.icon
          const isActive = panelId === active
          const isDragging = panelId === draggingPanel
          const showCodeContext = panelId === 'code'
          const title = showCodeContext && activeFile
            ? `${meta.label}: ${activeFile}${isDirty ? ' (unsaved)' : ''}`
            : meta.label

          return (
            <div key={panelId} className="flex items-center h-full group/tab">
              {/* Drop indicator */}
              {isDragOver && dropIndex === i && (
                <div className="w-[2px] h-4 bg-accent rounded-full shrink-0 mx-px" />
              )}
              <GripVertical size={10} className="opacity-0 group-hover/tab:opacity-100 transition-opacity text-text-faint cursor-grab shrink-0 -mr-0.5" />
              <button
                ref={(el) => { tabRefs.current[i] = el }}
                role="tab"
                aria-selected={isActive}
                draggable
                onDragStart={(e) => handleDragStart(e, panelId)}
                onDragEnd={handleDragEnd}
                onClick={() => setActiveTab(zone, panelId)}
                title={title}
                className={`flex items-center gap-1.5 h-full text-xs font-medium transition-colors border-b-2 px-2 cursor-grab active:cursor-grabbing select-none ${
                  isActive
                    ? 'border-accent text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                } ${isDragging ? 'opacity-40' : ''}`}
              >
                <Icon size={13} />
                <span>{meta.label}</span>
                {showCodeContext && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-current opacity-35" />
                    <span className="max-w-[16ch] truncate text-[11px] opacity-80">
                      {activeFileName}
                    </span>
                    {isDirty && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-warning shrink-0"
                        aria-label="Unsaved changes"
                        title="Unsaved changes"
                      />
                    )}
                  </>
                )}
              </button>
            </div>
          )
        })}
        {/* Trailing drop indicator */}
        {isDragOver && dropIndex === panels.length && (
          <div className="w-[2px] h-4 bg-accent rounded-full shrink-0 mx-px" />
        )}
      </div>

      {actions && <div className="ml-auto flex items-center">{actions}</div>}

      {/* First-visit drag tooltip */}
      {showDragTip && (
        <div
          className="absolute top-full left-4 mt-1 z-50 px-3 py-1.5 bg-bg-raised border border-border-default rounded-md shadow-md text-[11px] text-text-secondary whitespace-nowrap cursor-pointer"
          style={{ animation: 'dropIn 0.15s ease' }}
          onClick={() => { setShowDragTip(false); localStorage.setItem(DRAG_TIP_KEY, '1') }}
        >
          <div className="absolute -top-1 left-6 w-2 h-2 bg-bg-raised border-l border-t border-border-default rotate-45" />
          Drag tabs to rearrange your workspace
        </div>
      )}
    </div>
  )
}
