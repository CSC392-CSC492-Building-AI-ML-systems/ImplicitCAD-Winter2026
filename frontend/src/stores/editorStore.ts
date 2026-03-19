import { create } from 'zustand'
import { DEFAULT_CODE } from '../lib/examples'

let logIdCounter = 0

const savedTheme = localStorage.getItem('theme')
const initialDark = savedTheme === 'dark'
if (initialDark) {
  document.documentElement.classList.add('dark')
}

const STORAGE_KEY_CODE = 'implicitcad-code'
const savedCode = localStorage.getItem(STORAGE_KEY_CODE)
const initialCode = savedCode ?? DEFAULT_CODE

let saveTimer: ReturnType<typeof setTimeout> | undefined
function debouncedSave(code: string) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => localStorage.setItem(STORAGE_KEY_CODE, code), 500)
}

export interface LogEntry {
  id: number
  time: string
  message: string
  level: 'info' | 'success' | 'error' | 'warning'
}

export interface EditorError {
  line: number
  message: string
  severity: 'error' | 'warning'
}

interface EditorState {
  code: string
  autoRender: boolean
  isDark: boolean
  logs: LogEntry[]
  errors: EditorError[]
  cursorLine: number
  cursorColumn: number
  commandPaletteOpen: boolean
  setCode: (code: string) => void
  setAutoRender: (v: boolean) => void
  setIsDark: (v: boolean) => void
  log: (message: string, level?: LogEntry['level']) => void
  clearLogs: () => void
  setErrors: (errors: EditorError[]) => void
  setCursorPosition: (line: number, col: number) => void
  setCommandPaletteOpen: (v: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  code: initialCode,
  autoRender: true,
  isDark: initialDark,
  logs: [{ id: logIdCounter++, time: now(), message: 'Welcome to ImplicitCAD Studio', level: 'info' }],
  errors: [],
  cursorLine: 1,
  cursorColumn: 1,
  commandPaletteOpen: false,
  setCode: (code) => {
    debouncedSave(code)
    set({ code })
  },
  setAutoRender: (autoRender) => set({ autoRender }),
  setIsDark: (isDark) => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    set({ isDark })
  },
  log: (message, level = 'info') =>
    set((s) => ({ logs: [...s.logs.slice(-200), { id: logIdCounter++, time: now(), message, level }] })),
  clearLogs: () => set({ logs: [] }),
  setErrors: (errors) => set({ errors }),
  setCursorPosition: (cursorLine, cursorColumn) => set({ cursorLine, cursorColumn }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}))

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}
