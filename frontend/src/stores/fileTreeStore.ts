import { create } from 'zustand'
import { useEditorStore } from './editorStore'
import { useLayoutStore, type ZoneId } from './layoutStore'

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  }
}

export interface FileEntry {
  path: string
  name: string
  kind: 'file' | 'directory'
  depth: number
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
}

export interface OpenFileTab {
  path: string
  name: string
  handle: FileSystemFileHandle
  savedContent: string
  draftContent: string
}

type PendingAction = { type: 'close-file'; path: string } | { type: 'close-folder' } | null

interface FileTreeState {
  rootHandle: FileSystemDirectoryHandle | null
  rootName: string | null
  files: FileEntry[]
  openFiles: OpenFileTab[]
  activeFile: string | null
  expandedDirs: Set<string>
  activeFileHandle: FileSystemFileHandle | null
  sidebarOpen: boolean
  isDirty: boolean
  creatingEntry: { parentPath: string; kind: 'file' | 'directory' } | null
  pendingAction: PendingAction

  openFolder: () => Promise<void>
  openFile: (path: string) => Promise<void>
  setActiveFile: (path: string) => void
  requestCloseFile: (path: string) => void
  closeFile: (path: string) => void
  saveFile: (path?: string) => Promise<void>
  toggleDir: (path: string) => void
  closeFolder: () => void
  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void
  collapseAll: () => void
  createFile: (parentPath: string, name: string) => Promise<void>
  createFolder: (parentPath: string, name: string) => Promise<void>
  refreshTree: () => Promise<void>
  setCreatingEntry: (v: { parentPath: string; kind: 'file' | 'directory' } | null) => void
  revealInExplorer: (path?: string) => void
  confirmDiscardPending: () => void
  confirmSavePending: () => Promise<void>
  cancelPending: () => void
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.next', '.cache'])
const MAX_DEPTH = 8
const BINARY_EXTS = new Set(['stl', 'obj', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'woff', 'woff2', 'ttf', 'zip', 'gz', 'pdf'])

async function readDirRecursive(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  depth: number,
): Promise<FileEntry[]> {
  if (depth > MAX_DEPTH) return []

  const dirs: FileEntry[] = []
  const files: FileEntry[] = []

  for await (const entry of dirHandle.values()) {
    if (entry.name.startsWith('.') && entry.kind === 'directory') continue
    if (entry.kind === 'directory' && SKIP_DIRS.has(entry.name)) continue

    const path = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.kind === 'directory') {
      dirs.push({ path, name: entry.name, kind: 'directory', depth, handle: entry })
    } else {
      files.push({ path, name: entry.name, kind: 'file', depth, handle: entry })
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))

  const result: FileEntry[] = []
  for (const dir of dirs) {
    result.push(dir)
    const children = await readDirRecursive(
      dir.handle as FileSystemDirectoryHandle,
      dir.path,
      depth + 1,
    )
    result.push(...children)
  }
  result.push(...files)

  return result
}

function activateCodeTab() {
  const { zones, setActiveTab } = useLayoutStore.getState()
  for (const [zone, panels] of Object.entries(zones)) {
    if (panels.includes('code')) {
      setActiveTab(zone as ZoneId, 'code')
      break
    }
  }
}

function fileAncestors(path: string) {
  const parts = path.split('/')
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}

function updateDraftForPath(openFiles: OpenFileTab[], path: string | null, code: string) {
  if (!path) return openFiles
  const index = openFiles.findIndex((tab) => tab.path === path)
  if (index === -1) return openFiles
  if (openFiles[index].draftContent === code) return openFiles

  const next = openFiles.slice()
  next[index] = { ...next[index], draftContent: code }
  return next
}

function activeTabState(openFiles: OpenFileTab[], activePath: string | null) {
  const activeTab = activePath ? openFiles.find((tab) => tab.path === activePath) ?? null : null
  return {
    activeFileHandle: activeTab?.handle ?? null,
    isDirty: activeTab ? activeTab.savedContent !== activeTab.draftContent : false,
  }
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  rootHandle: null,
  rootName: null,
  files: [],
  openFiles: [],
  activeFile: null,
  expandedDirs: new Set<string>(),
  activeFileHandle: null,
  sidebarOpen: false,
  isDirty: false,
  creatingEntry: null,
  pendingAction: null,

  openFolder: async () => {
    if (!window.showDirectoryPicker) {
      useEditorStore.getState().log('Folder access requires Chrome or Edge', 'warning')
      return
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      const files = await readDirRecursive(handle, '', 0)

      set({
        rootHandle: handle,
        rootName: handle.name,
        files,
        openFiles: [],
        activeFile: null,
        activeFileHandle: null,
        expandedDirs: new Set<string>(),
        sidebarOpen: true,
        isDirty: false,
        creatingEntry: null,
        pendingAction: null,
      })

      useEditorStore.getState().setCode('')
      useEditorStore.getState().log(`Opened folder: ${handle.name}`, 'success')
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      useEditorStore.getState().log(`Failed to open folder: ${e}`, 'error')
    }
  },

  openFile: async (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    if (ext && BINARY_EXTS.has(ext)) {
      useEditorStore.getState().log(`Cannot open binary file: ${path.split('/').pop()}`, 'warning')
      return
    }

    const existing = get().openFiles.find((tab) => tab.path === path)
    if (existing) {
      get().setActiveFile(path)
      return
    }

    const entry = get().files.find((file) => file.path === path && file.kind === 'file')
    if (!entry) return

    try {
      const fileHandle = entry.handle as FileSystemFileHandle
      const file = await fileHandle.getFile()
      const text = await file.text()
      const currentCode = useEditorStore.getState().code

      set((state) => {
        const openFiles = updateDraftForPath(state.openFiles, state.activeFile, currentCode)
        const nextTab: OpenFileTab = {
          path,
          name: entry.name,
          handle: fileHandle,
          savedContent: text,
          draftContent: text,
        }
        const nextOpenFiles = [...openFiles, nextTab]
        return {
          openFiles: nextOpenFiles,
          activeFile: path,
          ...activeTabState(nextOpenFiles, path),
        }
      })

      useEditorStore.getState().setCode(text)
      get().revealInExplorer(path)
      activateCodeTab()
    } catch (e) {
      useEditorStore.getState().log(`Failed to read file: ${e}`, 'error')
    }
  },

  setActiveFile: (path: string) => {
    const target = get().openFiles.find((tab) => tab.path === path)
    if (!target) return

    const currentCode = useEditorStore.getState().code
    set((state) => {
      const openFiles = updateDraftForPath(state.openFiles, state.activeFile, currentCode)
      return {
        openFiles,
        activeFile: path,
        ...activeTabState(openFiles, path),
      }
    })

    useEditorStore.getState().setCode(target.draftContent)
    get().revealInExplorer(path)
    activateCodeTab()
  },

  requestCloseFile: (path: string) => {
    const { openFiles, activeFile } = get()
    const tab = openFiles.find((item) => item.path === path)
    if (!tab) return

    const draftContent = path === activeFile ? useEditorStore.getState().code : tab.draftContent
    if (draftContent === tab.savedContent) {
      get().closeFile(path)
      return
    }

    set({ pendingAction: { type: 'close-file', path } })
  },

  closeFile: (path: string) => {
    const currentCode = useEditorStore.getState().code
    let nextCode: string | null = null

    set((state) => {
      const syncedOpenFiles = updateDraftForPath(state.openFiles, state.activeFile === path ? null : state.activeFile, currentCode)
      const closingIndex = syncedOpenFiles.findIndex((tab) => tab.path === path)
      if (closingIndex === -1) return state

      const remaining = syncedOpenFiles.filter((tab) => tab.path !== path)
      if (state.activeFile !== path) {
        return {
          openFiles: remaining,
          pendingAction: null,
          ...activeTabState(remaining, state.activeFile),
        }
      }

      const nextTab = remaining[closingIndex] ?? remaining[closingIndex - 1] ?? null
      nextCode = nextTab?.draftContent ?? ''

      return {
        openFiles: remaining,
        activeFile: nextTab?.path ?? null,
        pendingAction: null,
        ...activeTabState(remaining, nextTab?.path ?? null),
      }
    })

    if (nextCode !== null) {
      useEditorStore.getState().setCode(nextCode)
    }
  },

  saveFile: async (path?: string) => {
    const { openFiles, activeFile } = get()
    const targetPath = path ?? activeFile
    if (!targetPath) {
      useEditorStore.getState().log('No file open to save', 'warning')
      return
    }

    const tab = openFiles.find((item) => item.path === targetPath)
    if (!tab) {
      useEditorStore.getState().log('No file open to save', 'warning')
      return
    }

    const content = targetPath === activeFile ? useEditorStore.getState().code : tab.draftContent

    try {
      const writable = await tab.handle.createWritable()
      await writable.write(content)
      await writable.close()

      set((state) => {
        const nextOpenFiles = state.openFiles.map((item) =>
          item.path === targetPath
            ? { ...item, savedContent: content, draftContent: content }
            : item
        )
        return {
          openFiles: nextOpenFiles,
          ...activeTabState(nextOpenFiles, state.activeFile),
        }
      })

      useEditorStore.getState().log(`Saved ${tab.name}`, 'success')
    } catch (e) {
      useEditorStore.getState().log(`Failed to save file: ${e}`, 'error')
    }
  },

  toggleDir: (path: string) => {
    set((state) => {
      const next = new Set(state.expandedDirs)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedDirs: next }
    })
  },

  closeFolder: () => {
    const { openFiles, activeFile } = get()
    const currentCode = useEditorStore.getState().code
    const hasDirty = openFiles.some((tab) => {
      const content = tab.path === activeFile ? currentCode : tab.draftContent
      return content !== tab.savedContent
    })

    if (hasDirty) {
      set({ pendingAction: { type: 'close-folder' } })
      return
    }

    set({
      rootHandle: null,
      rootName: null,
      files: [],
      openFiles: [],
      activeFile: null,
      activeFileHandle: null,
      expandedDirs: new Set<string>(),
      sidebarOpen: false,
      isDirty: false,
      creatingEntry: null,
      pendingAction: null,
    })
    useEditorStore.getState().setCode('')
  },

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  collapseAll: () => set({ expandedDirs: new Set() }),

  createFile: async (parentPath: string, name: string) => {
    const { rootHandle } = get()
    if (!rootHandle) return

    try {
      let dirHandle = rootHandle
      if (parentPath) {
        for (const seg of parentPath.split('/')) {
          dirHandle = await dirHandle.getDirectoryHandle(seg)
        }
      }
      await dirHandle.getFileHandle(name, { create: true })
      await get().refreshTree()
      const filePath = parentPath ? `${parentPath}/${name}` : name
      await get().openFile(filePath)
    } catch (e) {
      useEditorStore.getState().log(`Failed to create file: ${e}`, 'error')
    }
  },

  createFolder: async (parentPath: string, name: string) => {
    const { rootHandle } = get()
    if (!rootHandle) return

    try {
      let dirHandle = rootHandle
      if (parentPath) {
        for (const seg of parentPath.split('/')) {
          dirHandle = await dirHandle.getDirectoryHandle(seg)
        }
      }
      await dirHandle.getDirectoryHandle(name, { create: true })
      await get().refreshTree()
      set((state) => {
        const next = new Set(state.expandedDirs)
        if (parentPath) next.add(parentPath)
        next.add(parentPath ? `${parentPath}/${name}` : name)
        return { expandedDirs: next }
      })
    } catch (e) {
      useEditorStore.getState().log(`Failed to create folder: ${e}`, 'error')
    }
  },

  refreshTree: async () => {
    const { rootHandle } = get()
    if (!rootHandle) return

    const files = await readDirRecursive(rootHandle, '', 0)
    set({ files })
  },

  setCreatingEntry: (v) => set({ creatingEntry: v }),

  revealInExplorer: (path) => {
    const targetPath = path ?? get().activeFile
    if (!targetPath) return

    const targetEntry = get().files.find((entry) => entry.path === targetPath)
    const nextExpanded = new Set(get().expandedDirs)
    for (const ancestor of fileAncestors(targetPath)) {
      nextExpanded.add(ancestor)
    }
    if (targetEntry?.kind === 'directory') {
      nextExpanded.add(targetPath)
    }

    set({ sidebarOpen: true, expandedDirs: nextExpanded })
  },

  confirmDiscardPending: () => {
    const pendingAction = get().pendingAction
    set({ pendingAction: null })
    if (pendingAction?.type === 'close-file') {
      get().closeFile(pendingAction.path)
    } else if (pendingAction?.type === 'close-folder') {
      set({
        rootHandle: null,
        rootName: null,
        files: [],
        openFiles: [],
        activeFile: null,
        activeFileHandle: null,
        expandedDirs: new Set<string>(),
        sidebarOpen: false,
        isDirty: false,
        creatingEntry: null,
        pendingAction: null,
      })
      useEditorStore.getState().setCode('')
    }
  },

  confirmSavePending: async () => {
    const pendingAction = get().pendingAction
    set({ pendingAction: null })
    if (pendingAction?.type === 'close-file') {
      await get().saveFile(pendingAction.path)
      get().closeFile(pendingAction.path)
    } else if (pendingAction?.type === 'close-folder') {
      const { openFiles, activeFile } = get()
      const currentCode = useEditorStore.getState().code
      for (const tab of openFiles) {
        const content = tab.path === activeFile ? currentCode : tab.draftContent
        if (content !== tab.savedContent) {
          try {
            const writable = await tab.handle.createWritable()
            await writable.write(content)
            await writable.close()
          } catch {}
        }
      }
      set({
        rootHandle: null,
        rootName: null,
        files: [],
        openFiles: [],
        activeFile: null,
        activeFileHandle: null,
        expandedDirs: new Set<string>(),
        sidebarOpen: false,
        isDirty: false,
        creatingEntry: null,
        pendingAction: null,
      })
      useEditorStore.getState().setCode('')
    }
  },

  cancelPending: () => {
    set({ pendingAction: null })
  },
}))

// Keep the active tab's draft buffer synchronized with the editor.
useEditorStore.subscribe((state) => {
  useFileTreeStore.setState((store) => {
    const openFiles = updateDraftForPath(store.openFiles, store.activeFile, state.code)
    const next = activeTabState(openFiles, store.activeFile)

    if (openFiles === store.openFiles && next.isDirty === store.isDirty && next.activeFileHandle === store.activeFileHandle) {
      return store
    }

    return {
      openFiles,
      ...next,
    }
  })
})
