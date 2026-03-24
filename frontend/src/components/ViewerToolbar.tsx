import { useState, useRef, useEffect } from 'react'
import { Download, RotateCcw, Camera, Settings } from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'
import { useEditorStore } from '../stores/editorStore'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { Mesh as ThreeMesh, MeshBasicMaterial } from 'three'

function getQualityLabel(slider: number): string {
  if (slider === 50) return 'Auto (1.0)'
  let q: number
  if (slider < 50) {
    const t = slider / 50
    q = +(0.05 * Math.pow(0.9 / 0.05, t)).toFixed(3)
  } else {
    const t = (slider - 50) / 50
    q = +(1.0 * Math.pow(10 / 1.0, t)).toFixed(2)
  }
  if (q < 0.1) return q.toFixed(3)
  if (q < 1) return q.toFixed(2)
  if (q < 10) return q.toFixed(1)
  return q.toFixed(0)
}

export function ViewerToolbar() {
  const wireframe = useViewerStore((s) => s.wireframe)
  const gridXY = useViewerStore((s) => s.gridXY)
  const gridXZ = useViewerStore((s) => s.gridXZ)
  const gridYZ = useViewerStore((s) => s.gridYZ)
  const resolution = useViewerStore((s) => s.resolution)
  const geometry = useViewerStore((s) => s.geometry)
  const lastStlBlob = useViewerStore((s) => s.lastStlBlob)
  const toggleWireframe = useViewerStore((s) => s.toggleWireframe)
  const toggleGridXY = useViewerStore((s) => s.toggleGridXY)
  const toggleGridXZ = useViewerStore((s) => s.toggleGridXZ)
  const toggleGridYZ = useViewerStore((s) => s.toggleGridYZ)
  const setResolution = useViewerStore((s) => s.setResolution)
  const setCameraPreset = useViewerStore((s) => s.setCameraPreset)
  const fnSegments = useViewerStore((s) => s.fnSegments)
  const setFnSegments = useViewerStore((s) => s.setFnSegments)
  const compilerResolution = useViewerStore((s) => s.compilerResolution)
  const setCompilerResolution = useViewerStore((s) => s.setCompilerResolution)
  const compatMode = useViewerStore((s) => s.compatMode)
  const setCompatMode = useViewerStore((s) => s.setCompatMode)
  const log = useEditorStore((s) => s.log)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settingsOpen) return
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [settingsOpen])

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = 'viewport.png'
    a.click()
    log('Viewport screenshot saved', 'success')
  }

  const handleExport = () => {
    if (lastStlBlob) {
      downloadBlob(lastStlBlob, 'model.stl')
      log('Downloaded STL (from compilation)', 'success')
      return
    }
    if (!geometry) {
      log('No model to export', 'warning')
      return
    }
    try {
      const mesh = new ThreeMesh(geometry, new MeshBasicMaterial())
      const exporter = new STLExporter()
      const stlString = exporter.parse(mesh)
      const blob = new Blob([stlString], { type: 'application/sla' })
      downloadBlob(blob, 'model.stl')
      log(`Exported STL (${(blob.size / 1024).toFixed(1)} KB)`, 'success')
    } catch (e: unknown) {
      log(`Export failed: ${e instanceof Error ? e.message : e}`, 'error')
    }
  }

  if (!geometry) return null

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

      {/* Right top — actions */}
      <div className="absolute top-2 right-2 flex flex-col gap-px p-1 bg-bg-base/80 rounded-lg border border-border-default/60 shadow-sm backdrop-blur-md">
        <ActionBtn icon={<RotateCcw size={13} />} title="Reset View" onClick={() => setCameraPreset('reset')} />
        <ActionBtn icon={<Download size={13} />} title="Export STL" onClick={handleExport} />
        <ActionBtn icon={<Camera size={13} />} title="Screenshot" onClick={handleScreenshot} />
        <div className="h-px w-full bg-border-default/50 my-0.5" />

        {/* Settings popover */}
        <div className="relative" ref={settingsRef}>
          <ActionBtn
            icon={<Settings size={13} />}
            title="Render Settings"
            active={settingsOpen}
            onClick={() => setSettingsOpen(!settingsOpen)}
          />

          {settingsOpen && (
            <div className="absolute top-0 right-full mr-2 w-52 bg-bg-base/95 rounded-lg border border-border-default shadow-lg backdrop-blur-md animate-drop-in">
              <div className="px-3 py-2 border-b border-border-default">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Quality ($quality)</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={resolution}
                    onChange={(e) => setResolution(+e.target.value)}
                    className="flex-1 h-[3px] bg-border-default rounded-sm appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg-base [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-bg-base [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:bg-border-default [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-sm"
                  />
                  <span className="font-mono text-[10px] text-accent font-medium w-14 text-right">{getQualityLabel(resolution)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 px-3 py-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-text-muted">$fn (segments)</label>
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

                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-text-muted">Resolution (-r)</label>
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

                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-text-muted">OpenSCAD Compat</label>
                  <button
                    role="switch"
                    aria-checked={compatMode}
                    aria-label="OpenSCAD compatibility mode"
                    onClick={() => setCompatMode(!compatMode)}
                    className={`relative w-7 h-4 rounded-full transition-colors ${compatMode ? 'bg-accent' : 'bg-border-strong'}`}
                  >
                    <span className={`absolute top-[2px] w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${compatMode ? 'left-[13px]' : 'left-[2px]'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/** Toggle button for grid/wireframe — shows a text label */
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

/** Icon action button for export/screenshot/settings */
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
