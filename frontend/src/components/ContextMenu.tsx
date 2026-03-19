import { useEffect, useRef, useState, useCallback } from 'react'

export interface ContextMenuItem {
  label: string
  danger?: boolean
  action: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const actionItems = items.filter((item) => item.label !== 'separator')
  const [focusIndex, setFocusIndex] = useState(0)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => (i + 1) % actionItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => (i - 1 + actionItems.length) % actionItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      actionItems[focusIndex]?.action()
      onClose()
    }
  }, [onClose, actionItems, focusIndex])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, handleKeyDown])

  // Auto-focus first item on mount
  useEffect(() => {
    const el = ref.current?.querySelector('[role="menuitem"]') as HTMLElement | null
    el?.focus()
  }, [])

  // Focus the active menuitem when focusIndex changes
  useEffect(() => {
    const menuItems = ref.current?.querySelectorAll('[role="menuitem"]')
    if (menuItems && menuItems[focusIndex]) {
      (menuItems[focusIndex] as HTMLElement).focus()
    }
  }, [focusIndex])

  // Clamp position to viewport
  const clampedX = Math.min(x, window.innerWidth - 200)
  const clampedY = Math.min(y, window.innerHeight - items.length * 32 - 16)

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[100] min-w-[160px] bg-bg-base border border-border-default rounded-lg shadow-lg py-1 overflow-hidden animate-drop-in"
      style={{ left: clampedX, top: clampedY }}
    >
      {items.map((item, i) => {
        if (item.label === 'separator') {
          return <div key={i} className="h-px bg-border-default my-1" />
        }
        const actionIdx = actionItems.indexOf(item)
        const isFocused = actionIdx === focusIndex
        return (
          <button
            key={i}
            role="menuitem"
            tabIndex={isFocused ? 0 : -1}
            onClick={() => { item.action(); onClose() }}
            className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors outline-none ${
              item.danger
                ? `text-error ${isFocused ? 'bg-error/10' : 'hover:bg-error/10'}`
                : `${isFocused ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
