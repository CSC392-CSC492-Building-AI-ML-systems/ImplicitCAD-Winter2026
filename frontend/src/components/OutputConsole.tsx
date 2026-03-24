import { useRef, useEffect, useState, useCallback } from 'react'
import { ArrowDown } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'

const levelColor = {
  info: 'text-text-secondary',
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
} as const

export function OutputConsole() {
  const logs = useEditorStore((s) => s.logs)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [hasNewLogs, setHasNewLogs] = useState(false)

  const checkNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setIsNearBottom(near)
    if (near) setHasNewLogs(false)
  }, [])

  useEffect(() => {
    if (isNearBottom) {
      containerRef.current?.scrollTo(0, containerRef.current.scrollHeight)
      return
    }

    const frame = requestAnimationFrame(() => setHasNewLogs(true))
    return () => cancelAnimationFrame(frame)
  }, [logs, isNearBottom])

  const scrollToBottom = () => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
    setHasNewLogs(false)
  }

  return (
    <div className="flex flex-col h-full bg-bg-base relative">
      <div ref={containerRef} onScroll={checkNearBottom} className="flex-1 px-3.5 py-2 font-mono text-[11px] leading-[1.7] text-text-secondary overflow-y-auto">
        {logs.map((entry) => (
          <div key={entry.id} className={`py-px ${levelColor[entry.level]}`}>
            <span className="text-text-faint">[{entry.time}]</span> {entry.message}
          </div>
        ))}
      </div>
      {hasNewLogs && !isNearBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[var(--z-panel)] flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-accent text-white rounded-full shadow-md hover:bg-accent-hover transition-colors"
        >
          <ArrowDown size={12} /> New logs
        </button>
      )}
    </div>
  )
}
