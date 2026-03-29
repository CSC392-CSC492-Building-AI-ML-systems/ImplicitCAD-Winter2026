import { useState, useRef, useEffect } from 'react'
import { Download, RotateCcw, Settings, FolderDown } from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import { useEditorStore } from '../stores/editorStore'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { Mesh as ThreeMesh, MeshBasicMaterial } from 'three'

export function ViewerToolbar({ onRerender }: { onRerender?: () => void }) {
  const wireframe = useViewerStore((s) => s.wireframe)
  const gridXY = useViewerStore((s) => s.gridXY)
  const gridXZ = useViewerStore((s) => s.gridXZ)
  const gridYZ = useViewerStore((s) => s.gridYZ)
  const geometry = useViewerStore((s) => s.geometry)
  const lastStlBlob = useViewerStore((s) => s.lastStlBlob)
  const toggleWireframe = useViewerStore((s) => s.toggleWireframe)
  const toggleGridXY = useViewerStore((s) => s.toggleGridXY)
  const toggleGridXZ = useViewerStore((s) => s.toggleGridXZ)
  const toggleGridYZ = useViewerStore((s) => s.toggleGridYZ)
  const setCameraPreset = useViewerStore((s) => s.setCameraPreset)
  const fnSegments = useViewerStore((s) => s.fnSegments)
  const setFnSegments = useViewerStore((s) => s.setFnSegments)
  const compilerResolution = useViewerStore((s) => s.compilerResolution)
  const setCompilerResolution = useViewerStore((s) => s.setCompilerResolution)
  const compatMode = useViewerStore((s) => s.compatMode)
  const setCompatMode = useViewerStore((s) => s.setCompatMode)
  const modelName = useViewerStore((s) => s.modelName)
  const autoDownload = useViewerStore((s) => s.autoDownload)
  const setAutoDownload = useViewerStore((s) => s.setAutoDownload)
  const log = useEditorStore((s) => s.log)
  const rootHandle = useFileTreeStore((s) => s.rootHandle)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [downloadConfirm, setDownloadConfirm] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const downloadRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)

  // Close popovers on outside click / Escape
  useEffect(() => {
    if (!settingsOpen && !downloadConfirm) return
    const handleClick = (e: MouseEvent) => {
      if (settingsOpen && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
      if (downloadConfirm && downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadConfirm(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSettingsOpen(false); setDownloadConfirm(false) }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [settingsOpen, downloadConfirm])

  // Auto-rerender when compilation settings change (debounced)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (!onRerender) return
    const timer = setTimeout(() => onRerender(), 600)
    return () => clearTimeout(timer)
  }, [compilerResolution, fnSegments, compatMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const getBlob = (): Blob | null => {
    if (lastStlBlob) return lastStlBlob
    if (!geometry) return null
    try {
      const mesh = new ThreeMesh(geometry, new MeshBasicMaterial())
      const exporter = new STLExporter()
      const stlString = exporter.parse(mesh)
      return new Blob([stlString], { type: 'application/sla' })
    } catch (e) {
      useEditorStore.getState().log(`STL export failed: ${e instanceof Error ? e.message : e}`, 'error')
      useEditorStore.getState().addToast('Failed to export STL', 'error')
      return null
    }
  }

  const saveToFolder = async (blob: Blob) => {
    if (!rootHandle) return false
    try {
      const handle = await rootHandle.getFileHandle(`${modelName}.stl`, { create: true })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      log(`Saved ${modelName}.stl to project folder`, 'success')
      // Refresh file tree
      useFileTreeStore.getState().refreshTree?.()
      return true
    } catch (e: unknown) {
      log(`Save failed: ${e instanceof Error ? e.message : e}`, 'error')
      return false
    }
  }

  const handleExport = async () => {
    const blob = getBlob()
    if (!blob) { log('No model to export', 'warning'); return }

    if (!autoDownload) {
      setDownloadConfirm(true)
      return
    }

    if (rootHandle) {
      await saveToFolder(blob)
    } else {
      downloadBlob(blob, `${modelName}.stl`)
      log(`Downloaded ${modelName}.stl (${(blob.size / 1024).toFixed(1)} KB)`, 'success')
    }
  }

  const confirmDownload = async () => {
    const blob = getBlob()
    if (!blob) return
    setDownloadConfirm(false)
    if (rootHandle) {
      await saveToFolder(blob)
    } else {
      downloadBlob(blob, `${modelName}.stl`)
      log(`Downloaded ${modelName}.stl (${(blob.size / 1024).toFixed(1)} KB)`, 'success')
    }
  }

  if (!geometry) return null

  const blobSize = lastStlBlob ? lastStlBlob.size : null
  const hasFolderOpen = !!rootHandle

  return (
    <>
      {/* Left top — grid & wireframe toggles */}
      <div className="absolute top-2 left-2 flex flex-col gap-px p-1 bg-bg-base/80 rounded-lg border border-border-default/60 shadow-sm backdrop-blur-md">
        <ToggleBtn label="XY" title="Grid XY (floor)" active={gridXY} onClick={toggleGridXY} />
        <ToggleBtn label="XZ" title="Grid XZ (front wall)" active={gridXZ} onClick={toggleGridXZ} />
        <ToggleBtn label="YZ" title="Grid YZ (side wall)" active={gridYZ} onClick={toggleGridYZ} />
        <div className="h-px w-full bg-border-default/50 my-0.5" />
        <ToggleBtn label="W" title="Wireframe" active={wireframe} onClick={toggleWireframe} />
      </div>

      {/* Right top — actions & settings */}
      <div className="absolute top-2 right-2 flex flex-col gap-px p-1 bg-bg-base/80 rounded-lg border border-border-default/60 shadow-sm backdrop-blur-md z-[var(--z-dropdown)]">
        <ActionBtn icon={<RotateCcw size={13} />} title="Reset View" onClick={() => setCameraPreset('reset')} />

        {/* Download / Save */}
        <div className="relative" ref={downloadRef}>
          <ActionBtn
            icon={hasFolderOpen ? <FolderDown size={13} /> : <Download size={13} />}
            title={hasFolderOpen ? 'Save to folder' : 'Export STL'}
            onClick={handleExport}
          />
          {downloadConfirm && blobSize != null && (
            <div className="absolute top-0 right-full mr-2 w-48 bg-bg-base/95 rounded-lg border border-border-default shadow-lg backdrop-blur-md animate-drop-in p-3 flex flex-col gap-2">
              <div className="text-[10px] text-text-muted">
                <span className="font-medium text-text-primary">{modelName}.stl</span>
                <span className="ml-1.5">({(blobSize / 1024).toFixed(1)} KB)</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={confirmDownload} className="flex-1 px-2 py-1 text-[10px] font-medium bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">
                  {hasFolderOpen ? 'Save' : 'Download'}
                </button>
                <button onClick={() => setDownloadConfirm(false)} className="px-2 py-1 text-[10px] font-medium text-text-muted border border-border-default rounded-md hover:text-text-primary transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-px w-full bg-border-default/50 my-0.5" />

        {/* Settings popover */}
        <div className="relative" ref={settingsRef}>
          <ActionBtn
            icon={<Settings size={13} />}
            title="Compilation Settings"
            active={settingsOpen}
            onClick={() => setSettingsOpen(!settingsOpen)}
          />

          <div className={`absolute top-0 right-full mr-2 w-56 bg-bg-base/95 rounded-lg border border-border-default shadow-lg backdrop-blur-md transition-all duration-150 origin-top-right ${
            settingsOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'
          }`}>
            <div className="px-3 py-2 border-b border-border-default">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Compilation</label>
            </div>

            <div className="flex flex-col gap-2.5 px-3 py-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-text-secondary">Resolution (-r)</label>
                  <input
                    type="number"
                    min={0.5}
                    max={20}
                    step={0.5}
                    value={compilerResolution}
                    onChange={(e) => setCompilerResolution(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-bg-surface border border-border-default rounded font-mono text-[10px] text-text-primary outline-none focus-visible:border-accent text-right"
                  />
                </div>
                <div className="text-[9px] text-text-muted mt-0.5">Lower = finer detail, slower compile</div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-text-secondary">$fn (segments)</label>
                  <input
                    type="number"
                    min={3}
                    max={360}
                    placeholder="Auto"
                    value={fnSegments ?? ''}
                    onChange={(e) => setFnSegments(e.target.value ? Number(e.target.value) : null)}
                    className="w-16 px-1.5 py-0.5 bg-bg-surface border border-border-default rounded font-mono text-[10px] text-text-primary outline-none focus-visible:border-accent text-right"
                  />
                </div>
                <div className="text-[9px] text-text-muted mt-0.5">Curve smoothness (higher = rounder)</div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[10px] font-medium text-text-secondary">OpenSCAD Compat</label>
                  <div className="text-[9px] text-text-muted mt-0.5">--fopenscad-compat flag</div>
                </div>
                <button
                  role="switch"
                  aria-checked={compatMode}
                  aria-label="OpenSCAD compatibility mode"
                  onClick={() => setCompatMode(!compatMode)}
                  className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${compatMode ? 'bg-accent' : 'bg-border-strong'}`}
                >
                  <span className={`absolute top-[2px] w-3 h-3 rounded-full bg-[var(--switch-knob)] shadow-sm transition-transform ${compatMode ? 'left-[13px]' : 'left-[2px]'}`} />
                </button>
              </div>
            </div>

            <div className="px-3 py-2 border-t border-border-default">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Export</label>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5">
              <div>
                <label className="text-[10px] font-medium text-text-secondary">Auto-download</label>
                <div className="text-[9px] text-text-muted mt-0.5">When off, shows file size first</div>
              </div>
              <button
                role="switch"
                aria-checked={autoDownload}
                aria-label="Auto-download STL"
                onClick={() => setAutoDownload(!autoDownload)}
                className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${autoDownload ? 'bg-accent' : 'bg-border-strong'}`}
              >
                <span className={`absolute top-[2px] w-3 h-3 rounded-full bg-[var(--switch-knob)] shadow-sm transition-transform ${autoDownload ? 'left-[13px]' : 'left-[2px]'}`} />
              </button>
            </div>

            <div className="px-3 py-2 border-t border-border-default text-[9px] text-text-muted">
              Settings auto-apply on change
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ToggleBtn({ label, title, active, onClick }: { label: string; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`h-6 px-2 flex items-center justify-center rounded text-[9px] font-mono font-bold transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
        active
          ? 'bg-accent text-white shadow-sm'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
      }`}
    >
      {label}
    </button>
  )
}

function ActionBtn({ icon, title, active, onClick }: { icon: React.ReactNode; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`w-6 h-6 flex items-center justify-center rounded transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
        active
          ? 'bg-accent text-white shadow-sm'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
      }`}
    >
      {icon}
    </button>
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
