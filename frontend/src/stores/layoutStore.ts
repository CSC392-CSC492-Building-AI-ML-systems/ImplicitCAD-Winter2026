import { create } from 'zustand'

export type PanelId = 'code' | 'ref' | 'chat' | 'viewer' | 'output'
export type ZoneId = 'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight'
export interface DragState {
  panelId: PanelId
  fromZone: ZoneId
}

interface LayoutState {
  zones: Record<ZoneId, PanelId[]>
  activeTab: Record<ZoneId, PanelId>
  isDragging: boolean
  dragState: DragState | null
  movePanel: (panelId: PanelId, fromZone: ZoneId, toZone: ZoneId, insertIndex?: number) => void
  setActiveTab: (zone: ZoneId, panelId: PanelId) => void
  setDragging: (v: boolean) => void
  setDragState: (dragState: DragState | null) => void
  resetLayout: () => void
}

const ALL_PANELS: PanelId[] = ['code', 'ref', 'chat', 'viewer', 'output']

const DEFAULT_ZONES: Record<ZoneId, PanelId[]> = {
  topLeft: ['code', 'ref'],
  bottomLeft: ['chat'],
  topRight: ['viewer'],
  bottomRight: ['output'],
}

const DEFAULT_ACTIVE: Record<ZoneId, PanelId> = {
  topLeft: 'code',
  bottomLeft: 'chat',
  topRight: 'viewer',
  bottomRight: 'output',
}

const STORAGE_KEY = 'implicitcad-layout'

function getSibling(zone: ZoneId): ZoneId {
  switch (zone) {
    case 'topLeft': return 'bottomLeft'
    case 'bottomLeft': return 'topLeft'
    case 'topRight': return 'bottomRight'
    case 'bottomRight': return 'topRight'
  }
}

function isValidLayout(zones: Record<ZoneId, PanelId[]>): boolean {
  const allPanels = Object.values(zones).flat()
  if (allPanels.length !== ALL_PANELS.length) return false
  for (const p of ALL_PANELS) {
    if (allPanels.filter((x) => x === p).length !== 1) return false
  }
  // Each column must have at least one non-empty zone
  const leftHasPanels = zones.topLeft.length > 0 || zones.bottomLeft.length > 0
  const rightHasPanels = zones.topRight.length > 0 || zones.bottomRight.length > 0
  if (!leftHasPanels || !rightHasPanels) return false
  return true
}

function loadLayout(): { zones: Record<ZoneId, PanelId[]>; activeTab: Record<ZoneId, PanelId> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { zones: DEFAULT_ZONES, activeTab: DEFAULT_ACTIVE }
    const parsed = JSON.parse(raw)
    if (!parsed.zones) return { zones: DEFAULT_ZONES, activeTab: DEFAULT_ACTIVE }
    // Migration: strip removed 'files' panel from old persisted layouts
    for (const z of Object.keys(parsed.zones) as ZoneId[]) {
      parsed.zones[z] = (parsed.zones[z] as string[]).filter((p: string) => p !== 'files')
    }
    if (!isValidLayout(parsed.zones)) return { zones: DEFAULT_ZONES, activeTab: DEFAULT_ACTIVE }
    // Rebuild activeTab from saved, falling back to first panel in each zone
    const activeTab = {} as Record<ZoneId, PanelId>
    for (const z of Object.keys(parsed.zones) as ZoneId[]) {
      const saved = parsed.activeTab?.[z]
      activeTab[z] = parsed.zones[z].includes(saved) ? saved : parsed.zones[z][0]
    }
    return { zones: parsed.zones, activeTab }
  } catch {
    return { zones: DEFAULT_ZONES, activeTab: DEFAULT_ACTIVE }
  }
}

function persist(zones: Record<ZoneId, PanelId[]>, activeTab: Record<ZoneId, PanelId>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones, activeTab }))
}

const initial = loadLayout()

export const useLayoutStore = create<LayoutState>((set) => ({
  zones: initial.zones,
  activeTab: initial.activeTab,
  isDragging: false,
  dragState: null,
  setDragging: (isDragging) => set({ isDragging }),
  setDragState: (dragState) => set({ dragState }),

  movePanel: (panelId, fromZone, toZone, insertIndex) =>
    set((state) => {
      const zones = structuredClone(state.zones)
      const activeTab = { ...state.activeTab }

      if (fromZone === toZone) {
        // Reorder within same zone
        const list = zones[fromZone]
        const oldIdx = list.indexOf(panelId)
        if (oldIdx === -1) return state
        list.splice(oldIdx, 1)
        const idx = insertIndex != null ? Math.min(insertIndex, list.length) : list.length
        list.splice(idx, 0, panelId)
        activeTab[fromZone] = panelId
        persist(zones, activeTab)
        return { zones, activeTab }
      }

      const sourceList = zones[fromZone]
      const targetList = zones[toZone]

      if (sourceList.length > 1) {
        // Move panel from source to target
        sourceList.splice(sourceList.indexOf(panelId), 1)
        const idx = insertIndex != null ? Math.min(insertIndex, targetList.length) : targetList.length
        targetList.splice(idx, 0, panelId)
        // Fix source active tab
        if (activeTab[fromZone] === panelId) {
          activeTab[fromZone] = sourceList[0]
        }
        activeTab[toZone] = panelId
      } else {
        // Source has 1 tab — check if sibling zone has panels
        const siblingZone = getSibling(fromZone)
        if (zones[siblingZone].length > 0) {
          // Sibling covers the column → allow source to become empty
          sourceList.splice(0, 1)
          const idx = insertIndex != null ? Math.min(insertIndex, targetList.length) : targetList.length
          targetList.splice(idx, 0, panelId)
          activeTab[toZone] = panelId
        } else {
          // Both zones in source column would be empty → swap instead
          const targetActive = activeTab[toZone]
          targetList.splice(targetList.indexOf(targetActive), 1)
          const idx = insertIndex != null ? Math.min(insertIndex, targetList.length) : targetList.length
          targetList.splice(idx, 0, panelId)
          sourceList[0] = targetActive
          activeTab[fromZone] = targetActive
          activeTab[toZone] = panelId
        }
      }

      persist(zones, activeTab)
      return { zones, activeTab }
    }),

  setActiveTab: (zone, panelId) =>
    set((state) => {
      if (!state.zones[zone].includes(panelId)) return state
      const activeTab = { ...state.activeTab, [zone]: panelId }
      persist(state.zones, activeTab)
      return { activeTab }
    }),

  resetLayout: () =>
    set(() => {
      persist(DEFAULT_ZONES, DEFAULT_ACTIVE)
      return { zones: DEFAULT_ZONES, activeTab: DEFAULT_ACTIVE }
    }),
}))
