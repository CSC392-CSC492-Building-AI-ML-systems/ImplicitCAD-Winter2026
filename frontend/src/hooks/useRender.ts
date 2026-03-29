import { useCallback, useRef } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { useViewerStore } from '../stores/viewerStore'
import { useEditorStore, type EditorError } from '../stores/editorStore'

function parseErrors(text: string): EditorError[] {
  const results: EditorError[] = []
  const pattern = /(?:line|Line|:)\s*(\d+)[:\s]+(.+)/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    results.push({
      line: parseInt(match[1], 10),
      message: match[2].trim(),
      severity: /warning/i.test(match[2]) ? 'warning' : 'error',
    })
  }
  if (results.length === 0 && text.trim()) {
    results.push({ line: 1, message: text.trim(), severity: 'error' })
  }
  return results
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const win = window as any

export function useRender() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const jsonpTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const log = useEditorStore((s) => s.log)
  const setGeometry = useViewerStore((s) => s.setGeometry)
  const setLastStlBlob = useViewerStore((s) => s.setLastStlBlob)
  const setRendering = useViewerStore((s) => s.setRendering)

  const compileSTL = useCallback(
    async (code: string) => {
      // Save current settings so they can be reverted on cancel
      useViewerStore.getState().savePrevSettings()

      const controller = new AbortController()
      useViewerStore.getState().setAbortController(controller)
      setRendering(true)
      log('Compiling...', 'info')

      const { fnSegments, compilerResolution, compatMode } = useViewerStore.getState()
      let processedCode = code
      if (fnSegments != null && !/\$fn\s*=/.test(code)) {
        processedCode = `$fn = ${fnSegments};\n${processedCode}`
      }

      try {
        const resp = await fetch('/api/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: processedCode,
            resolution: compilerResolution,
            compatMode,
          }),
          signal: controller.signal,
        })

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({ error: 'Unknown error' }))
          log(`Compile error: ${data.error}`, 'error')
          useEditorStore.getState().addToast('Compilation failed', 'error')
          useEditorStore.getState().setErrors(parseErrors(data.error || ''))
          setRendering(false)
          return
        }

        // Read admesh validation from response header
        const validationHeader = resp.headers.get('X-Validation')
        const { setValidation } = useViewerStore.getState()
        if (validationHeader) {
          try {
            setValidation(JSON.parse(validationHeader))
          } catch (e) {
            console.warn('Validation header parse error:', e)
            setValidation(null)
          }
        } else {
          setValidation(null)
        }

        const buf = await resp.arrayBuffer()
        setLastStlBlob(new Blob([buf], { type: 'application/sla' }))
        const loader = new STLLoader()
        const geometry = loader.parse(buf)
        geometry.computeVertexNormals()
        setGeometry(geometry)
        log(`Compiled (${(buf.byteLength / 1024).toFixed(1)} KB, ${geometry.attributes.position.count / 3} faces)`, 'success')
        useEditorStore.getState().setErrors([])
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          log('Compilation cancelled', 'warning')
        } else {
          log(`Connection error: ${e instanceof Error ? e.message : e}`, 'error')
          useEditorStore.getState().addToast('Connection error — is the server running?', 'error')
        }
        useEditorStore.getState().setErrors([])
      } finally {
        setRendering(false)
        useViewerStore.getState().setAbortController(null)
      }
    },
    [log, setGeometry, setLastStlBlob, setRendering],
  )

  const compileJSONP = useCallback(
    (code: string) => {
      if (jsonpTimeoutRef.current) clearTimeout(jsonpTimeoutRef.current)
      setRendering(true)
      log('Rendering via implicitsnap...', 'info')

      const cbName = 'icad_cb_' + Date.now()

      const cleanup = () => {
        delete win[cbName]
        const s = document.getElementById('jsonp-script')
        if (s) s.remove()
      }

      win[cbName] = (result: any) => {
        if (jsonpTimeoutRef.current) clearTimeout(jsonpTimeoutRef.current)
        cleanup()
        setRendering(false)
        useViewerStore.getState().setValidation(null)

        if (!Array.isArray(result) || result.length < 2) {
          log('Invalid server response', 'error')
          return
        }

        const [shapeData, messages] = result
        if (messages) {
          const msgLevel = messages.includes('ERROR') ? 'error' : messages.includes('WARNING') ? 'warning' : 'success'
          log(messages, msgLevel)
          if (messages.includes('ERROR')) {
            useEditorStore.getState().setErrors(parseErrors(messages))
          }
        }

        if (!shapeData || typeof shapeData === 'string') {
          log('No geometry generated', 'error')
          return
        }

        try {
          const geometry = new BufferGeometry()
          const verts = shapeData.vertices || []
          const faces = shapeData.faces || []
          const positions: number[] = []
          for (const f of faces) {
            const a = verts[f.a] || verts[f.a] || { x: 0, y: 0, z: 0 }
            const b = verts[f.b] || { x: 0, y: 0, z: 0 }
            const c = verts[f.c] || { x: 0, y: 0, z: 0 }
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
          }
          geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
          geometry.computeVertexNormals()
          setGeometry(geometry)
          log(`Render complete (${verts.length} verts, ${faces.length} faces)`, 'success')
          useEditorStore.getState().setErrors([])
        } catch (e: unknown) {
          log(`Mesh error: ${e instanceof Error ? e.message : e}`, 'error')
        }
      }

      const old = document.getElementById('jsonp-script')
      if (old) old.remove()

      const url = `/render/?source=${encodeURIComponent(code)}&callback=${cbName}&format=jsTHREE`
      const script = document.createElement('script')
      script.id = 'jsonp-script'
      script.src = url
      script.onerror = () => {
        if (jsonpTimeoutRef.current) clearTimeout(jsonpTimeoutRef.current)
        cleanup()
        setRendering(false)
        log('Cannot connect to implicitsnap. Is it running on port 8080?', 'error')
        useEditorStore.getState().addToast('Cannot connect to render server', 'error')
        useEditorStore.getState().setErrors([])
      }
      document.body.appendChild(script)

      jsonpTimeoutRef.current = setTimeout(() => {
        if (useViewerStore.getState().isRendering) {
          cleanup()
          setRendering(false)
          log('Render timeout — model may be too complex', 'error')
          useEditorStore.getState().setErrors([])
        }
      }, 60000)
    },
    [log, setGeometry, setRendering],
  )

  const render = useCallback(
    (code: string) => {
      const mode = useViewerStore.getState().backendMode
      if (mode === 'implicitsnap') {
        compileJSONP(code)
      } else {
        // Default to the Docker/STL path for null or docker mode.
        // This avoids accidentally hitting the legacy JSONP renderer while
        // backend detection is still in progress.
        compileSTL(code)
      }
    },
    [compileSTL, compileJSONP],
  )

  const scheduleRender = useCallback(
    (code: string, delay = 800) => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => render(code), delay)
    },
    [render],
  )

  return { render, scheduleRender }
}
