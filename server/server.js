/**
 * ImplicitCAD Studio — Backend Server
 *
 * Provides:
 *   POST /api/compile   — compile .scad code via extopenscad → STL
 *   POST /api/chat      — LLM code generation via CLI tool
 *   GET  /api/health    — liveness check
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')
const { spawn, execSync } = require('child_process')

const os = require('os')

const PORT = parseInt(process.env.PORT || '4000', 10)
const WORKSPACE = process.env.WORKSPACE || path.join(process.cwd(), '_workspace')
const LLM_COMMAND = process.env.LLM_COMMAND || 'claude -p'
const EXTOPENSCAD = process.env.EXTOPENSCAD || findExtopenscad()
const ADMESH = process.env.ADMESH || findAdmesh()
const COMPILE_TIMEOUT = parseInt(process.env.COMPILE_TIMEOUT || '60', 10) * 1000

function findExtopenscad() {
  try { return execSync('which extopenscad 2>/dev/null').toString().trim() } catch {}
  const candidates = [
    '/usr/local/bin/extopenscad',
    path.join(os.homedir(), '.cabal/bin/extopenscad'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return 'extopenscad'
}

function findAdmesh() {
  try { return execSync('which admesh 2>/dev/null').toString().trim() } catch {}
  const candidates = [
    '/usr/bin/admesh',
    '/usr/local/bin/admesh',
    '/opt/homebrew/bin/admesh',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

function runAdmesh(stlPath) {
  return new Promise((resolve) => {
    if (!ADMESH) { resolve(null); return }
    const proc = spawn(ADMESH, [stlPath])
    let stdout = ''
    proc.stdout.on('data', d => stdout += d)
    proc.stderr.on('data', () => {})
    const timer = setTimeout(() => { proc.kill('SIGTERM'); resolve(null) }, 10000)
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) { resolve(null); return }
      try {
        const num = (pattern) => {
          const m = stdout.match(pattern)
          return m ? parseFloat(m[1]) : 0
        }
        const int = (pattern) => {
          const m = stdout.match(pattern)
          return m ? parseInt(m[1], 10) : 0
        }
        resolve({
          volume: num(/Volume\s*[=:]\s*([\d.e+-]+)/i),
          surfaceArea: num(/Surface Area\s*[=:]\s*([\d.e+-]+)/i),
          boundingBox: {
            minX: num(/Min X\s*[=:]\s*([\d.e+-]+)/i),
            maxX: num(/Max X\s*[=:]\s*([\d.e+-]+)/i),
            minY: num(/Min Y\s*[=:]\s*([\d.e+-]+)/i),
            maxY: num(/Max Y\s*[=:]\s*([\d.e+-]+)/i),
            minZ: num(/Min Z\s*[=:]\s*([\d.e+-]+)/i),
            maxZ: num(/Max Z\s*[=:]\s*([\d.e+-]+)/i),
          },
          facets: int(/Number of facets\s*[=:]\s*(\d+)/i) || int(/(\d+)\s+facets/i),
          parts: int(/Number of parts\s*[=:]\s*(\d+)/i) || int(/(\d+)\s+parts/i),
          degenerateFacets: int(/degenerate facets\s*[=:]\s*(\d+)/i),
          edgesFixed: int(/edges fixed\s*[=:]\s*(\d+)/i),
          facetsRemoved: int(/facets removed\s*[=:]\s*(\d+)/i),
          facetsAdded: int(/facets added\s*[=:]\s*(\d+)/i),
          isWatertight: (int(/Number of parts\s*[=:]\s*(\d+)/i) || int(/(\d+)\s+parts/i) || 1) === 1 && int(/edges fixed\s*[=:]\s*(\d+)/i) === 0,
        })
      } catch {
        resolve(null)
      }
    })
    proc.on('error', () => { clearTimeout(timer); resolve(null) })
  })
}

if (!fs.existsSync(WORKSPACE)) {
  fs.mkdirSync(WORKSPACE, { recursive: true })
}

// Load ImplicitCAD manual for LLM system prompt
function loadSystemPrompt() {
  const paths = [
    path.join(__dirname, 'implicitcad-manual.md'),
    path.join(__dirname, '..', 'ai_context', 'implicitcad-manual.md'),
  ]
  for (const p of paths) {
    try {
      const manual = fs.readFileSync(p, 'utf8')
      return `You are an expert at generating ImplicitCAD (ExtOpenSCAD) code. Output ONLY valid ImplicitCAD code, no markdown fences, no explanations outside // comments.\n\nCRITICAL: ImplicitCAD is NOT full OpenSCAD. hull, minkowski, offset, resize, polyhedron, surface, text, import are NOT supported.\n\n---\n\n${manual}\n\n---\n\nOUTPUT RULES:\n1. Output ONLY valid ImplicitCAD code.\n2. If modifying existing code, output COMPLETE updated code.\n3. Prefer ImplicitCAD extensions: union(r=N), cube(r=N), torus(), ellipsoid().\n4. NEVER use unsupported features.\n5. Keep code self-contained.`
    } catch {}
  }
  return 'You generate ImplicitCAD code. Use: cube, sphere, cylinder, cone, torus, ellipsoid. CSG: union(r=N), difference(r=N), intersection(r=N). NO hull, minkowski, offset, resize, text, import. Output ONLY code.'
}

const SYSTEM_PROMPT = loadSystemPrompt()

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk; if (body.length > 1024 * 1024) reject(new Error('Too large')) })
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) } })
    req.on('error', reject)
  })
}

function safePath(p) {
  const base = path.resolve(WORKSPACE)
  const resolved = path.resolve(WORKSPACE, p)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null
  return resolved
}

function extractCode(response) {
  if (!response?.trim()) return ''
  const patterns = [/```(?:openscad|scad|)\s*\n([\s\S]*?)```/i, /```\s*\n([\s\S]*?)```/]
  for (const p of patterns) {
    const m = response.match(p)
    if (m) return m[1].trim()
  }
  return response.trim()
}

function executeLLM(prompt) {
  return new Promise((resolve, reject) => {
    const args = LLM_COMMAND.split(/\s+/)
    const cmd = args.shift()
    const proc = spawn(cmd, args, { shell: true, env: { ...process.env }, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    proc.stdout.on('data', d => stdout += d)
    proc.stderr.on('data', d => stderr += d)
    const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('LLM timeout')) }, 120000)
    proc.on('close', code => { clearTimeout(timer); code !== 0 ? reject(new Error(stderr || 'LLM failed')) : resolve(stdout) })
    proc.on('error', err => { clearTimeout(timer); reject(err) })
    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

// ── Compile ──────────────────────────────────────────────────────────────────

function compileScad(code, options = {}) {
  return new Promise((resolve) => {
    const tmpDir = os.tmpdir()
    const id = `icad_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const scadPath = path.join(tmpDir, `${id}.scad`)
    const ext = options.format === 'obj' ? 'obj' : 'stl'
    const outPath = path.join(tmpDir, `${id}.${ext}`)

    fs.writeFileSync(scadPath, code)

    const args = []
    const res = options.resolution || '2'
    args.push('-r', res)
    if (options.compatMode !== false) args.push('--fopenscad-compat')
    args.push('-q', scadPath, '-o', outPath)

    const proc = spawn(EXTOPENSCAD, args)
    let stderr = ''
    proc.stderr.on('data', d => stderr += d)

    const timer = setTimeout(() => { proc.kill('SIGTERM') }, COMPILE_TIMEOUT)

    proc.on('close', async (exitCode) => {
      clearTimeout(timer)
      try { fs.unlinkSync(scadPath) } catch {}

      if (exitCode !== 0 || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
        try { fs.unlinkSync(outPath) } catch {}
        resolve({ ok: false, error: stderr.trim().slice(0, 1000) || 'Compilation failed' })
        return
      }

      const data = fs.readFileSync(outPath)
      let validation = null
      if (ext === 'stl') {
        validation = await runAdmesh(outPath)
      }
      try { fs.unlinkSync(outPath) } catch {}
      resolve({ ok: true, data, validation })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      try { fs.unlinkSync(scadPath) } catch {}
      resolve({ ok: false, error: `Cannot run extopenscad: ${err.message}` })
    })
  })
}

// ── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Expose-Headers', 'X-Validation')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const parsed = url.parse(req.url, true)
  const pathname = parsed.pathname

  // Health
  if (pathname === '/api/health' && req.method === 'GET') {
    let extopenscadOk = false
    try { execSync(`${EXTOPENSCAD} --help 2>&1`, { timeout: 5000 }); extopenscadOk = true } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', extopenscad: EXTOPENSCAD, extopenscadOk, admeshOk: !!ADMESH, llmCommand: LLM_COMMAND, workspace: WORKSPACE }))
    return
  }

  // Compile
  if (pathname === '/api/compile' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      if (!body.code?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'Empty code' })); return }
      const result = await compileScad(body.code, {
        resolution: body.resolution,
        compatMode: body.compatMode,
        format: body.format,
      })
      if (result.ok) {
        const headers = {
          'Content-Type': result.data.length ? 'application/sla' : 'application/octet-stream',
          'Content-Length': result.data.length,
        }
        if (result.validation) {
          headers['X-Validation'] = JSON.stringify(result.validation)
          headers['Access-Control-Expose-Headers'] = 'X-Validation'
        }
        res.writeHead(200, headers)
        res.end(result.data)
      } else {
        res.writeHead(422, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: result.error }))
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // Chat
  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      if (!body.prompt?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'Prompt required' })); return }
      let fullPrompt = SYSTEM_PROMPT + '\n\n'
      if (body.code?.trim()) fullPrompt += `Current code:\n\`\`\`\n${body.code.trim()}\n\`\`\`\n\n`
      if (body.history?.length) {
        fullPrompt += 'Previous conversation:\n'
        for (const m of body.history.slice(-6)) fullPrompt += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n`
        fullPrompt += '\n'
      }
      fullPrompt += `User request: ${body.prompt.trim()}\n\nGenerate the OpenSCAD code:`

      const raw = await executeLLM(fullPrompt)
      const code = extractCode(raw)
      if (!code) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Empty LLM response', raw: raw.slice(0, 500) }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code, message: 'Code generated' }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message, hint: `Ensure "${LLM_COMMAND}" is installed. Set LLM_COMMAND env var.` }))
    }
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

// ── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('')
  console.log('┌──────────────────────────────────────────────────┐')
  console.log('│        ImplicitCAD Studio — Server                │')
  console.log('├──────────────────────────────────────────────────┤')
  console.log(`│  API:         http://localhost:${PORT}                │`)
  console.log(`│  extopenscad: ${EXTOPENSCAD.slice(0, 36).padEnd(36)}│`)
  console.log(`│  LLM CLI:     ${LLM_COMMAND.padEnd(36)}│`)
  console.log(`│  Workspace:   ${WORKSPACE.slice(0, 36).padEnd(36)}│`)
  console.log('├──────────────────────────────────────────────────┤')
  console.log('│  POST /api/compile  — compile .scad → STL       │')
  console.log('│  POST /api/chat     — AI code generation        │')
  console.log('│  GET  /api/health   — status check              │')
  console.log('└──────────────────────────────────────────────────┘')
  console.log('')
})
