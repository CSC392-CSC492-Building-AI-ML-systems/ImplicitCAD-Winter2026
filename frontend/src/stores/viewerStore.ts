import { create } from 'zustand'
import { type BufferGeometry, Vector3, type PerspectiveCamera } from 'three'

export interface ModelInfo {
  sizeX: number
  sizeY: number
  sizeZ: number
  faces: number
  vertices: number
}

export interface AdmeshValidation {
  volume: number
  surfaceArea: number
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  facets: number
  parts: number
  degenerateFacets: number
  edgesFixed: number
  facetsRemoved: number
  facetsAdded: number
  isWatertight: boolean
}

interface ViewerState {
  geometry: BufferGeometry | null
  modelInfo: ModelInfo | null
  lastStlBlob: Blob | null
  isRendering: boolean
  wireframe: boolean
  showGrid: boolean
  gridXY: boolean
  gridXZ: boolean
  gridYZ: boolean
  backendMode: 'implicitsnap' | 'docker' | null
  cameraRef: PerspectiveCamera | null
  controlsRef: { target: Vector3; update: () => void } | null
  fnSegments: number | null
  compilerResolution: string
  compatMode: boolean
  validation: AdmeshValidation | null
  modelName: string
  autoDownload: boolean
  abortController: AbortController | null
  prevSettings: { compilerResolution: string; fnSegments: number | null; compatMode: boolean } | null
  setGeometry: (g: BufferGeometry | null) => void
  setLastStlBlob: (b: Blob | null) => void
  setRendering: (v: boolean) => void
  toggleWireframe: () => void
  toggleGrid: () => void
  toggleGridXY: () => void
  toggleGridXZ: () => void
  toggleGridYZ: () => void
  setBackendMode: (m: 'implicitsnap' | 'docker' | null) => void
  setCameraRef: (c: PerspectiveCamera | null) => void
  setControlsRef: (c: { target: Vector3; update: () => void } | null) => void
  setCameraPreset: (preset: 'front' | 'top' | 'iso' | 'reset') => void
  setFnSegments: (v: number | null) => void
  setCompilerResolution: (v: string) => void
  setCompatMode: (v: boolean) => void
  setValidation: (v: AdmeshValidation | null) => void
  setModelName: (v: string) => void
  setAutoDownload: (v: boolean) => void
  setAbortController: (c: AbortController | null) => void
  cancelRender: () => void
  savePrevSettings: () => void
  revertSettings: () => void
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  geometry: null,
  modelInfo: null,
  lastStlBlob: null,
  isRendering: false,
  wireframe: false,
  showGrid: true,
  gridXY: true,
  gridXZ: false,
  gridYZ: false,
  backendMode: null,
  cameraRef: null,
  controlsRef: null,
  fnSegments: null,
  compilerResolution: '2',
  compatMode: true,
  validation: null,
  modelName: localStorage.getItem('implicitcad-model-name') || 'model',
  autoDownload: localStorage.getItem('implicitcad-auto-download') !== 'false',
  abortController: null,
  prevSettings: null,

  setGeometry: (geometry) => {
    let modelInfo: ModelInfo | null = null
    if (geometry) {
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      const size = new Vector3()
      box.getSize(size)
      modelInfo = {
        sizeX: +size.x.toFixed(2),
        sizeY: +size.y.toFixed(2),
        sizeZ: +size.z.toFixed(2),
        faces: Math.floor(geometry.attributes.position.count / 3),
        vertices: geometry.attributes.position.count,
      }
    }
    set({ geometry, modelInfo })
  },

  setLastStlBlob: (lastStlBlob) => set({ lastStlBlob }),
  setRendering: (isRendering) => set({ isRendering }),
  toggleWireframe: () => set((s) => ({ wireframe: !s.wireframe })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleGridXY: () => set((s) => {
    const next = !s.gridXY
    return { gridXY: next, showGrid: next || s.gridXZ || s.gridYZ }
  }),
  toggleGridXZ: () => set((s) => {
    const next = !s.gridXZ
    return { gridXZ: next, showGrid: next || s.gridXY || s.gridYZ }
  }),
  toggleGridYZ: () => set((s) => {
    const next = !s.gridYZ
    return { gridYZ: next, showGrid: next || s.gridXY || s.gridXZ }
  }),
  setBackendMode: (backendMode) => set({ backendMode }),
  setCameraRef: (cameraRef) => set({ cameraRef }),
  setControlsRef: (controlsRef) => set({ controlsRef }),
  setFnSegments: (fnSegments) => set({ fnSegments }),
  setCompilerResolution: (compilerResolution) => set({ compilerResolution }),
  setCompatMode: (compatMode) => set({ compatMode }),
  setValidation: (validation) => set({ validation }),
  setModelName: (modelName) => { localStorage.setItem('implicitcad-model-name', modelName); set({ modelName }) },
  setAutoDownload: (autoDownload) => { localStorage.setItem('implicitcad-auto-download', String(autoDownload)); set({ autoDownload }) },
  setAbortController: (abortController) => set({ abortController }),
  cancelRender: () => {
    const { abortController } = get()
    if (abortController) abortController.abort()
    set({ isRendering: false, abortController: null })
  },
  savePrevSettings: () => {
    const { compilerResolution, fnSegments, compatMode } = get()
    set({ prevSettings: { compilerResolution, fnSegments, compatMode } })
  },
  revertSettings: () => {
    const { prevSettings } = get()
    if (prevSettings) {
      set({ compilerResolution: prevSettings.compilerResolution, fnSegments: prevSettings.fnSegments, compatMode: prevSettings.compatMode, prevSettings: null })
    }
  },

  setCameraPreset: (preset) => {
    const { cameraRef: cam, controlsRef: ctrl, geometry } = get()
    if (!cam || !ctrl) return

    const center = new Vector3(0, 0, 0)
    let dist = 80

    if (geometry) {
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      box.getCenter(center)
      const size = new Vector3()
      box.getSize(size)
      dist = Math.max(size.x, size.y, size.z) * 2.5
    }

    switch (preset) {
      case 'front':
        cam.position.set(center.x, center.y - dist, center.z)
        break
      case 'top':
        cam.position.set(center.x, center.y, center.z + dist)
        break
      case 'iso':
        cam.position.set(center.x + dist * 0.7, center.y + dist * 0.7, center.z + dist * 0.7)
        break
      case 'reset':
        cam.position.set(50, 50, 50)
        center.set(0, 0, 0)
        break
    }

    ctrl.target.copy(center)
    ctrl.update()
  },
}))
