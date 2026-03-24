import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useViewerStore } from '../stores/viewerStore'

export function ModelInfoPanel() {
  const modelInfo = useViewerStore((s) => s.modelInfo)
  const validation = useViewerStore((s) => s.validation)
  const [expanded, setExpanded] = useState(false)

  if (!modelInfo) return null

  const hasValidation = validation != null

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[var(--z-panel)] bg-bg-base/80 backdrop-blur-md rounded-lg border border-border-default/60 shadow-sm overflow-hidden transition-all">
      {/* Collapsed summary */}
      <button
        onClick={() => hasValidation && setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] text-text-secondary w-full text-left ${hasValidation ? 'cursor-pointer hover:bg-bg-hover' : 'cursor-default'}`}
      >
        <span>
          <span className="font-semibold text-text-primary">{modelInfo.sizeX}</span> x{' '}
          <span className="font-semibold text-text-primary">{modelInfo.sizeY}</span> x{' '}
          <span className="font-semibold text-text-primary">{modelInfo.sizeZ}</span> mm
          <span className="mx-2 text-border-strong">|</span>
          {modelInfo.faces.toLocaleString()} faces
        </span>
        {hasValidation && (
          <span className="flex items-center gap-1 ml-1">
            {validation.isWatertight ? (
              <CheckCircle2 size={13} className="text-success" />
            ) : (
              <AlertTriangle size={13} className="text-warning" />
            )}
            {expanded ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
          </span>
        )}
      </button>

      {/* Expanded details */}
      {hasValidation && (
        <div className={`grid transition-all duration-200 ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
        <div className="px-3 pb-3 border-t border-border-default">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2.5 text-[11px]">
            <div className="text-text-muted">Volume</div>
            <div className="font-mono text-text-primary text-right">{validation.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

            <div className="text-text-muted">Surface Area</div>
            <div className="font-mono text-text-primary text-right">{validation.surfaceArea.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>

          {/* Bounding Box */}
          <div className="mt-2.5 pt-2 border-t border-border-default">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Bounding Box</div>
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
              <div className="text-text-muted text-center">X</div>
              <div className="text-text-muted text-center">Y</div>
              <div className="text-text-muted text-center">Z</div>
              <div className="text-text-secondary text-center">{validation.boundingBox.minX.toFixed(1)}</div>
              <div className="text-text-secondary text-center">{validation.boundingBox.minY.toFixed(1)}</div>
              <div className="text-text-secondary text-center">{validation.boundingBox.minZ.toFixed(1)}</div>
              <div className="text-text-secondary text-center">{validation.boundingBox.maxX.toFixed(1)}</div>
              <div className="text-text-secondary text-center">{validation.boundingBox.maxY.toFixed(1)}</div>
              <div className="text-text-secondary text-center">{validation.boundingBox.maxZ.toFixed(1)}</div>
            </div>
          </div>

          {/* Mesh Health */}
          <div className="mt-2.5 pt-2 border-t border-border-default">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Mesh Health</div>
            <div className="flex flex-col gap-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-text-muted">Watertight</span>
                <span className={validation.isWatertight ? 'text-success font-medium' : 'text-warning font-medium'}>
                  {validation.isWatertight ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Parts</span>
                <span className={`font-mono ${validation.parts > 1 ? 'text-warning' : 'text-text-primary'}`}>{validation.parts}</span>
              </div>
              {validation.degenerateFacets > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Degenerate facets</span>
                  <span className="font-mono text-error">{validation.degenerateFacets}</span>
                </div>
              )}
              {validation.edgesFixed > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Edges fixed</span>
                  <span className="font-mono text-warning">{validation.edgesFixed}</span>
                </div>
              )}
              {validation.facetsRemoved > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Facets removed</span>
                  <span className="font-mono text-warning">{validation.facetsRemoved}</span>
                </div>
              )}
              {validation.facetsAdded > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Facets added</span>
                  <span className="font-mono text-warning">{validation.facetsAdded}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
        </div>
      )}
    </div>
  )
}
