import { useRef, useEffect, useMemo, useState, Component, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { PerspectiveCamera, Vector3, Mesh, MeshPhongMaterial, DoubleSide, PCFSoftShadowMap } from 'three'
import { useViewerStore } from '../stores/viewerStore'
import { useEditorStore } from '../stores/editorStore'
import { Box, Cuboid, Loader2 } from 'lucide-react'
import { ModelInfoPanel } from './ModelInfoPanel'

function AxisLine({ direction, color, length = 60 }: { direction: 'x' | 'y' | 'z'; color: string; length?: number }) {
  const radius = 0.2
  const coneR = 0.7
  const coneH = 2.5

  const rotation: [number, number, number] =
    direction === 'x' ? [0, 0, -Math.PI / 2]
    : direction === 'z' ? [Math.PI / 2, 0, 0]
    : [0, 0, 0]

  const conePos: [number, number, number] =
    direction === 'x' ? [length, 0, 0]
    : direction === 'y' ? [0, length, 0]
    : [0, 0, length]

  return (
    <group>
      <mesh rotation={rotation}>
        <cylinderGeometry args={[radius, radius, length * 2, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={conePos} rotation={rotation}>
        <coneGeometry args={[coneR, coneH, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function CameraRegistrar() {
  const { camera } = useThree()
  const setCameraRef = useViewerStore((s) => s.setCameraRef)
  useEffect(() => {
    setCameraRef(camera as PerspectiveCamera)
    return () => setCameraRef(null)
  }, [camera, setCameraRef])
  return null
}

function ControlsRegistrar() {
  const { controls } = useThree()
  const setControlsRef = useViewerStore((s) => s.setControlsRef)
  useEffect(() => {
    if (controls && 'target' in (controls as object)) {
      setControlsRef(controls as unknown as { target: Vector3; update: () => void })
    }
    return () => setControlsRef(null)
  }, [controls, setControlsRef])
  return null
}

function ModelMesh() {
  const geometry = useViewerStore((s) => s.geometry)
  const wireframe = useViewerStore((s) => s.wireframe)
  const meshRef = useRef<Mesh>(null)
  const materialRef = useRef<MeshPhongMaterial>(null)
  const { camera, controls } = useThree()

  // Fade in animation
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0
      let frame: number
      const animate = () => {
        if (!materialRef.current) return
        materialRef.current.opacity += 0.05
        if (materialRef.current.opacity < 0.92) {
          frame = requestAnimationFrame(animate)
        } else {
          materialRef.current.opacity = 0.92
        }
      }
      frame = requestAnimationFrame(animate)
      return () => cancelAnimationFrame(frame)
    }
  }, [geometry])

  useEffect(() => {
    if (!geometry || !meshRef.current) return
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const center = new Vector3()
    box.getCenter(center)
    const size = new Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const dist = maxDim * 2.5

    camera.position.set(center.x + dist, center.y + dist, center.z + dist)
    if (controls && 'target' in (controls as object)) {
      const orbitControls = controls as unknown as { target: Vector3; update: () => void }
      orbitControls.target.copy(center)
      orbitControls.update()
    }
  }, [geometry, camera, controls])

  if (!geometry) return null

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshPhongMaterial
        ref={materialRef}
        color="#4F86F7"
        specular="#cccccc"
        shininess={50}
        flatShading
        wireframe={wireframe}
        side={DoubleSide}
        transparent
        opacity={0}
      />
    </mesh>
  )
}

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const gridProps = {
  args: [200, 200] as [number, number],
  cellSize: 2,
  cellThickness: 0.5,
  sectionSize: 10,
  sectionThickness: 1,
  fadeDistance: 150,
  fadeStrength: 3,
  side: DoubleSide,
}

function SceneContent() {
  const gridXY = useViewerStore((s) => s.gridXY)
  const gridXZ = useViewerStore((s) => s.gridXZ)
  const gridYZ = useViewerStore((s) => s.gridYZ)
  const isDark = useEditorStore((s) => s.isDark)
  const themeColors = useMemo(() => ({
    gridCell: getCSSVar('--border-subtle'),
    gridSection: getCSSVar('--border-default'),
    axisRed: getCSSVar('--error'),
    axisGreen: getCSSVar('--success'),
    axisBlue: getCSSVar('--accent'),
  }), [isDark])

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[40, 60, 80]} intensity={0.65} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-40, -30, 20]} intensity={0.3} color="#B0C4DE" />
      <directionalLight position={[0, -50, -30]} intensity={0.2} color="#E0E7FF" />

      {gridXY && (
        <Grid
          {...gridProps}
          cellColor={themeColors.gridCell}
          sectionColor={themeColors.gridSection}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
        />
      )}
      {gridXZ && (
        <Grid
          {...gridProps}
          cellColor={themeColors.gridCell}
          sectionColor={themeColors.gridSection}
          rotation={[0, 0, 0]}
          position={[0, 0, 0]}
        />
      )}
      {gridYZ && (
        <Grid
          {...gridProps}
          cellColor={themeColors.gridCell}
          sectionColor={themeColors.gridSection}
          rotation={[0, Math.PI / 2, 0]}
          position={[0, 0, 0]}
        />
      )}

      <AxisLine direction="x" color={themeColors.axisRed} />
      <AxisLine direction="y" color={themeColors.axisGreen} />
      <AxisLine direction="z" color={themeColors.axisBlue} />

      <ModelMesh />
      <CameraRegistrar />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      <ControlsRegistrar />
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport />
      </GizmoHelper>
    </>
  )
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted p-8 text-center">
          <Box size={40} className="opacity-30" />
          <div className="text-sm font-medium">3D Viewer failed to load</div>
          <div className="text-xs text-text-faint max-w-xs">{this.state.error}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-3 py-1.5 text-xs bg-accent text-white rounded-md"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent)
const modKey = isMac ? '⌘' : 'Ctrl'

function RenderingOverlay() {
  const isRendering = useViewerStore((s) => s.isRendering)
  const cancelRender = useViewerStore((s) => s.cancelRender)
  const revertSettings = useViewerStore((s) => s.revertSettings)
  const [elapsed, setElapsed] = useState(0)
  const [showCancel, setShowCancel] = useState(false)

  useEffect(() => {
    if (!isRendering) { setElapsed(0); setShowCancel(false); return }
    const start = Date.now()
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000)
      setElapsed(s)
      if (s >= 5) setShowCancel(true)
    }, 1000)
    return () => clearInterval(timer)
  }, [isRendering])

  if (!isRendering) return null

  const handleCancel = () => {
    cancelRender()
    revertSettings()
  }

  return (
    <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-[var(--z-panel-overlay)] transition-opacity">
      <Loader2 size={32} className="animate-spin text-accent" />
      <div className="text-sm text-text-secondary">Compiling...{elapsed > 0 ? ` ${elapsed}s` : ''}</div>
      {showCancel && (
        <div className="flex flex-col items-center gap-2 mt-2 animate-drop-in">
          <div className="text-[11px] text-text-muted text-center max-w-[220px]">Taking a while? Cancel will revert to previous settings.</div>
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-[11px] font-medium bg-error text-white rounded-md hover:brightness-110 transition-all"
          >
            Cancel & Revert
          </button>
        </div>
      )}
    </div>
  )
}

export function STLViewer() {
  const geometry = useViewerStore((s) => s.geometry)
  const isRendering = useViewerStore((s) => s.isRendering)

  return (
    <div className="relative w-full h-full bg-viewport">
      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [50, 50, 50], up: [0, 0, 1], fov: 45, near: 0.1, far: 10000 }}
          shadows
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true
            gl.shadowMap.type = PCFSoftShadowMap
          }}
        >
          <SceneContent />
        </Canvas>
      </CanvasErrorBoundary>

      <RenderingOverlay />

      {/* Empty state */}
      {!geometry && !isRendering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-text-muted pointer-events-none backdrop-blur-md bg-bg-base/65">
          <Cuboid size={48} className="opacity-20 text-accent" strokeWidth={1} />
          <div className="flex flex-col items-center gap-1.5">
            <div className="text-sm font-semibold text-text-primary">
              No geometry loaded
            </div>
            <div className="text-[11px] text-text-muted">
              Write code or use AI to generate
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              Press <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-default rounded-md text-[10px] font-mono text-text-primary shadow-sm">{modKey}</kbd> + <kbd className="px-1.5 py-0.5 bg-bg-surface border border-border-default rounded-md text-[10px] font-mono text-text-primary shadow-sm">Enter</kbd> to render
            </div>
          </div>
        </div>
      )}

      {/* Model info overlay */}
      {!isRendering && <ModelInfoPanel />}
    </div>
  )
}
