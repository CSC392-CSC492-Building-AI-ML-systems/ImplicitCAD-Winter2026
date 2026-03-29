/**
 * ImplicitCAD Studio — Backend Server
 *
 * Provides:
 *   POST /api/compile          — compile .scad code via extopenscad → STL
 *   POST /api/chat             — LLM code generation (non-streaming)
 *   POST /api/chat/stream      — LLM code generation (SSE streaming)
 *   GET  /api/health           — liveness check
 *   GET  /api/providers/active  — current provider/model config
 *   POST /api/providers/select  — set active provider/model
 *   GET  /api/providers/models  — list available models for a provider
 *   GET  /api/providers/status  — diagnostics
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
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
let OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
let ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

// ── Provider Config ─────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(WORKSPACE, '.provider-config.json')

function loadProviderConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8')
    const config = JSON.parse(data)
    if (config.provider && config.model) return config
  } catch {}
  return {
    provider: process.env.ACTIVE_PROVIDER || 'ollama',
    model: process.env.ACTIVE_MODEL || '',  // Empty = auto-detect first available
  }
}

function saveProviderConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  } catch {}
}

let activeConfig = loadProviderConfig()

// Verify configured model exists, or auto-detect first available implicitcad-* model
async function autoDetectModel() {
  if (activeConfig.provider !== 'ollama') return
  try {
    const models = await listOllamaModels()
    const modelNames = models.map(m => m.name.replace(/:latest$/, ''))

    // If configured model exists, keep it
    if (activeConfig.model && modelNames.includes(activeConfig.model)) {
      console.log(`Using configured model: ${activeConfig.model}`)
      return
    }

    // Configured model doesn't exist (stale config) or empty — find first available
    const available = modelNames.find(n => n.startsWith('implicitcad'))
    if (available) {
      const prev = activeConfig.model
      activeConfig.model = available
      saveProviderConfig(activeConfig)
      console.log(`Model '${prev || '(none)'}' not found, switched to: ${available}`)
    } else if (!activeConfig.model) {
      activeConfig.model = 'implicitcad-dev'
      console.log('No implicitcad-* models found, defaulting to implicitcad-dev')
    }
  } catch {
    if (!activeConfig.model) activeConfig.model = 'implicitcad-dev'
  }
}

// ── Binary Discovery ────────────────────────────────────────────────────────

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

// ── System Prompt ───────────────────────────────────────────────────────────

function loadSystemPrompt() {
  const paths = [
    path.join(__dirname, 'implicitcad-manual.md'),
    path.join(__dirname, '..', 'ai_context', 'implicitcad-manual.md'),
  ]
  for (const p of paths) {
    try {
      const manual = fs.readFileSync(p, 'utf8')
      return `You are an expert at generating ImplicitCAD (ExtOpenSCAD) code.\n\nCRITICAL OUTPUT FORMAT:\n- Output ONLY valid ImplicitCAD code. Nothing else.\n- Do NOT explain your reasoning or thought process.\n- Do NOT include <think> tags or any internal reasoning.\n- Do NOT include markdown fences (\`\`\`).\n- Do NOT repeat the user's request in your output.\n- Your entire response must be valid, compilable ImplicitCAD code.\n- Comments are allowed ONLY as // inline comments within the code.\n\nCRITICAL: ImplicitCAD is NOT full OpenSCAD. hull, minkowski, offset, resize, polyhedron, surface, text, import are NOT supported.\n\n---\n\n${manual}\n\n---\n\nOUTPUT RULES:\n1. Output ONLY valid ImplicitCAD code — your entire response is code.\n2. If modifying existing code, output the COMPLETE updated file.\n3. Prefer ImplicitCAD extensions: union(r=N), cube(r=N), torus(), ellipsoid().\n4. NEVER use unsupported features.\n5. Keep code self-contained.\n6. NEVER output anything before or after the code.`
    } catch {}
  }
  return 'You generate ImplicitCAD code. Output ONLY valid code — no explanations, no reasoning, no <think> tags, no markdown fences. Your entire response must be compilable code. Use: cube, sphere, cylinder, cone, torus, ellipsoid. CSG: union(r=N), difference(r=N), intersection(r=N). NO hull, minkowski, offset, resize, text, import.'
}

const SYSTEM_PROMPT = loadSystemPrompt()

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function stripThinkBlocks(text) {
  if (!text) return ''
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim()
}

function stripTemplateArtifacts(text) {
  if (!text) return ''
  const marker = text.match(/<[^>\n]*(?:\|?im[_ ]?start\|?|\|?im[_ ]?end\|?|\|?endoftext\|?)[^>\n]*>/i)
  if (marker?.index != null) {
    return text.slice(0, marker.index).trim()
  }
  return text
}

function normalizeLoose(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function stripEchoedInputPrefix(text, inputCode, inputPrompt) {
  let remaining = (text || '').trim()

  if (inputCode) {
    const fencedEcho = remaining.match(/^Current code:\s*```(?:openscad|scad|implicit|)?\s*\n([\s\S]*?)```\s*/i)
    if (fencedEcho) {
      const echoedNorm = normalizeLoose(fencedEcho[1])
      const inputNorm = normalizeLoose(inputCode)
      if (echoedNorm === inputNorm || echoedNorm.includes(inputNorm) || inputNorm.includes(echoedNorm)) {
        remaining = remaining.slice(fencedEcho[0].length).trim()
      }
    }
  }

  if (inputPrompt) {
    remaining = remaining.replace(/^(?:User request:|Task:)\s*/i, '')
    if (remaining.startsWith(inputPrompt.trim())) {
      remaining = remaining.slice(inputPrompt.trim().length).trim()
    }
  }

  return remaining
}

function extractCode(response, inputCode, inputPrompt) {
  let cleaned = stripTemplateArtifacts(stripThinkBlocks(response))
  cleaned = stripEchoedInputPrefix(cleaned, inputCode, inputPrompt)
  if (!cleaned?.trim()) return ''

  const inputNorm = normalizeLoose(inputCode)

  // Helper: check if a code block is just the echoed input
  function isEcho(block) {
    if (!inputNorm) return false
    const blockNorm = block.trim().replace(/\s+/g, ' ')
    return blockNorm === inputNorm || inputNorm.includes(blockNorm) || blockNorm.includes(inputNorm)
  }

  // Find ALL fenced code blocks with their positions
  const fencePattern = /```(?:openscad|scad|implicit|)\s*\n([\s\S]*?)```/gi
  const blocks = []
  let m
  while ((m = fencePattern.exec(cleaned)) !== null) {
    blocks.push({ code: m[1].trim(), start: m.index, end: m.index + m[0].length })
  }

  if (blocks.length > 0) {
    // Filter out any blocks that are just echoed input
    const nonEcho = blocks.filter(b => !isEcho(b.code))

    if (nonEcho.length > 0) {
      // Return the last non-echo block
      return nonEcho[nonEcho.length - 1].code
    }

    // All blocks were echoes — strip them from cleaned text and look at remainder
    let remainder = cleaned
    for (const b of blocks.reverse()) {
      remainder = remainder.slice(0, b.start) + remainder.slice(b.end)
    }
    remainder = stripEchoedInputPrefix(remainder.replace(/Current code:\s*/gi, ''), inputCode, inputPrompt)

    // Check if remainder has unfenced code
    if (remainder && /^(?:\/\/|union|difference|intersection|cube|sphere|cylinder|translate|rotate|module|include)/m.test(remainder)) {
      // Extract just the code-looking portion
      const lines = remainder.split('\n')
      const codeLines = []
      let inCode = false
      for (const line of lines) {
        if (!inCode && /^(?:\/\/|union|difference|intersection|cube|sphere|cylinder|translate|rotate|module|include|\s*\{|\s*\})/.test(line)) {
          inCode = true
        }
        if (inCode) {
          // Stop at clearly non-code text
          if (/^(?:Add |Now |Complete |Create |Modify |The |This |User|Note|Task)/i.test(line.trim())) break
          codeLines.push(line)
        }
      }
      if (codeLines.length > 0) return codeLines.join('\n').trim()
    }

    // Fallback: return the last block even if it's an echo (better than nothing)
    return blocks[blocks.length - 1].code
  }

  // No fenced blocks at all — check if response looks like code
  const trimmed = cleaned.trim()
  if (/^(?:\/\/|union|difference|intersection|cube|sphere|cylinder|translate|rotate|module|include)/.test(trimmed)) {
    // Strip any trailing natural language
    const lines = trimmed.split('\n')
    const codeLines = []
    for (const line of lines) {
      if (/^(?:Add |Now |Complete |Create |Modify |The |This |User|Note|Task)/i.test(line.trim())) break
      codeLines.push(line)
    }
    return codeLines.join('\n').trim() || trimmed
  }

  // Last resort: find the earliest OpenSCAD primitive that starts a contiguous
  // code tail at the end of the response. Reasoning prose comes first, code last.
  // Collect all primitive positions, then pick the earliest one whose slice to end
  // contains only code (no sentence-like prose lines between primitives).
  const primitives = /(?:union|difference|intersection|cube|sphere|cylinder|translate|rotate|scale|linear_extrude|rotate_extrude|hull|module|include|import|torus|ellipsoid|cone)\s*\(/gi
  const matches = []
  let m2
  while ((m2 = primitives.exec(trimmed)) !== null) {
    matches.push(m2.index)
  }
  // Try from the earliest match — the longest valid tail wins
  for (const idx of matches) {
    const tail = trimmed.slice(idx).trim()
    if (!/[;}]/.test(tail)) continue
    // Reject if the tail still contains obvious prose (sentence with 5+ words before any code)
    const firstLine = tail.split('\n')[0]
    if (/^[A-Z][a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+/i.test(firstLine)) continue
    return tail
  }

  return ''
}

function consumeLeadingEcho(token, state) {
  if (!state.enabled || !token) return token
  if (!state.remaining.length) {
    state.enabled = false
    return token
  }

  let i = 0
  while (i < token.length && i < state.remaining.length && token[i] === state.remaining[i]) i++

  if (i === 0) {
    state.enabled = false
    return token
  }

  state.remaining = state.remaining.slice(i)
  if (!state.remaining.length) state.enabled = false
  return token.slice(i)
}

// ── Model Profiles ─────────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'implicitcad-dev':  { contextWindow: 4096, maxOutput: 768 },
  'implicitcad-9b':   { contextWindow: 32768, maxOutput: 2048 },
  'implicitcad-27b':  { contextWindow: 8192, maxOutput: 2048 },
}
const DEFAULT_PROFILE = { contextWindow: 4096, maxOutput: 1024 }

function getModelProfile(model) {
  if (!model) return DEFAULT_PROFILE
  const base = model.replace(/:latest$/, '')
  return MODEL_PROFILES[base] || DEFAULT_PROFILE
}

function threadContextEnabled() {
  return process.env.DISABLE_THREAD_CONTEXT !== '1'
}

// ── Thread State (server-side session memory) ──────────────────────────────

const threadState = new Map()
const THREAD_TTL = 3600000 // 1 hour

function getThread(sessionId) {
  if (!sessionId) sessionId = 'default'
  if (!threadState.has(sessionId)) {
    threadState.set(sessionId, {
      summary: '',
      recentUserPrompts: [],
      updatedAt: Date.now(),
    })
  }
  const t = threadState.get(sessionId)
  t.updatedAt = Date.now()
  return t
}

function updateThread(sessionId, userPrompt) {
  const thread = getThread(sessionId)
  thread.recentUserPrompts.push(userPrompt)

  // Compact: keep last 4 prompts as raw, older ones become summary bullets
  if (thread.recentUserPrompts.length > 4) {
    const old = thread.recentUserPrompts.splice(0, thread.recentUserPrompts.length - 4)
    const bullets = old.map(p => '- ' + p.slice(0, 80).replace(/\n/g, ' ')).join('\n')
    thread.summary = thread.summary
      ? thread.summary + '\n' + bullets
      : bullets
    // Cap summary length
    if (thread.summary.length > 500) {
      thread.summary = thread.summary.slice(-500)
    }
  }

  thread.updatedAt = Date.now()
  return thread
}

// Cleanup stale threads periodically
setInterval(() => {
  const now = Date.now()
  for (const [id, t] of threadState) {
    if (now - t.updatedAt > THREAD_TTL) threadState.delete(id)
  }
}, 600000)

// ── Token Estimation ───────────────────────────────────────────────────────

function estimateTokens(text) {
  if (!text) return 0
  const isCode = /[{};()=]/.test(text)
  return Math.ceil(text.length / (isCode ? 3 : 4))
}

// ── Prompt Assembly (priority-based packing) ───────────────────────────────

function buildMessages(prompt, code, sessionId) {
  const profile = getModelProfile(activeConfig.model)
  const maxContext = profile.contextWindow
  const maxOutput = profile.maxOutput
  const thread = getThread(sessionId)
  const includeThreadContext = threadContextEnabled()

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  const systemTokens = estimateTokens(SYSTEM_PROMPT)

  // Current user message (always included — highest priority)
  let userContent = ''
  if (code?.trim()) userContent += `Current code:\n\`\`\`\n${code.trim()}\n\`\`\`\n\n`
  userContent += prompt.trim()
  const userTokens = estimateTokens(userContent)

  // Check if base content fits
  if (systemTokens + userTokens + maxOutput > maxContext) {
    // Code too large — return error so frontend can inform user
    throw new Error(`Code is too large for the current model's context window (${maxContext} tokens). Try a shorter file or switch to a larger model.`)
  }

  let budget = maxContext - systemTokens - estimateTokens(userContent) - maxOutput

  // Priority 2: Recent user prompts (intent context, no AI code)
  if (includeThreadContext && thread.recentUserPrompts.length > 0 && budget > 100) {
    const contextBlock = thread.recentUserPrompts
      .map(p => 'User: ' + p.slice(0, 200))
      .join('\n')
    const tokens = estimateTokens(contextBlock)
    if (tokens <= budget) {
      messages.push({ role: 'user', content: 'Previous requests in this session:\n' + contextBlock })
      budget -= tokens
    }
  }

  // Priority 3: Rolling summary (lowest priority)
  if (includeThreadContext && thread.summary && budget > 50) {
    const summaryText = 'Summary of earlier conversation:\n' + thread.summary
    const tokens = estimateTokens(summaryText)
    if (tokens <= budget) {
      messages.push({ role: 'user', content: summaryText })
    }
  }

  messages.push({ role: 'user', content: userContent })

  // Debug: log prompt packing for remote diagnosis
  const totalEstTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  console.log(`[buildMessages] model=${activeConfig.model} msgs=${messages.length} est_tokens=${totalEstTokens}/${maxContext} max_output=${maxOutput} thread_context=${includeThreadContext ? 'on' : 'off'} thread_prompts=${thread.recentUserPrompts.length} has_summary=${!!thread.summary}`)

  return messages
}

// ── Provider: CLI (legacy) ──────────────────────────────────────────────────

function callLLMCli(prompt) {
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

// ── Provider: Ollama ────────────────────────────────────────────────────────

/** Extract text from an Ollama message object.
 *  Qwen3.5 thinking models put output in `thinking` instead of `content`. */
function getOllamaText(message) {
  return message?.content || message?.thinking || ''
}

async function callOllama(messages, model, stream = false) {
  const profile = getModelProfile(model)
  const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream,
      // Let the model think — server-side stripThinkBlocks() handles cleanup.
      // Suppressing thinking (think:false) degrades output quality.
      options: {
        num_predict: profile.maxOutput,
        repeat_penalty: 1.1,
      },
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Ollama error ${resp.status}: ${text.slice(0, 200)}`)
  }
  if (stream) return resp.body
  const data = await resp.json()
  return getOllamaText(data.message)
}

async function listOllamaModels() {
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!resp.ok) return []
    const data = await resp.json()
    return (data.models || []).map(m => ({ name: m.name, size: m.size, modified: m.modified_at }))
  } catch {
    return []
  }
}

async function isOllamaReachable() {
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return resp.ok
  } catch {
    return false
  }
}

// ── Provider: OpenAI ────────────────────────────────────────────────────────

async function callOpenAI(messages, model, stream = false) {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY env var.')
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, stream }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`OpenAI error ${resp.status}: ${text.slice(0, 200)}`)
  }
  if (stream) return resp.body
  const data = await resp.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Provider: Anthropic ─────────────────────────────────────────────────────

async function callAnthropic(messages, model, stream = false) {
  if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY env var.')

  // Anthropic Messages API: system goes in top-level field, not in messages array
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  const body = { model, max_tokens: 4096, messages: chatMessages }
  if (systemMsg) body.system = systemMsg.content
  if (stream) body.stream = true

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Anthropic error ${resp.status}: ${text.slice(0, 200)}`)
  }
  if (stream) return resp.body
  const data = await resp.json()
  return data.content?.[0]?.text || ''
}

// ── Provider Dispatch ───────────────────────────────────────────────────────

async function routeInference(messages, stream = false) {
  const { provider, model } = activeConfig
  switch (provider) {
    case 'ollama':    return callOllama(messages, model, stream)
    case 'openai':    return callOpenAI(messages, model, stream)
    case 'anthropic': return callAnthropic(messages, model, stream)
    default:          throw new Error(`Unknown provider: ${provider}`)
  }
}

// ── Stream Normalizer (converts provider streams to SSE) ────────────────────

async function* normalizeStream(providerStream, provider, traceId) {
  const decoder = new TextDecoder()
  const reader = providerStream.getReader()
  let buffer = ''
  let rawEventCount = 0
  let inThinkBlock = false
  let dropAfterTemplateMarker = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      if (provider === 'ollama') {
        // Ollama: newline-delimited JSON
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            let token = getOllamaText(data.message)
            // Debug: log first 10 raw events with full field structure
            if (process.env.DEBUG_LLM_STREAM === '1' && rawEventCount < 10) {
              rawEventCount++
              const msgKeys = Object.keys(data.message || {}).join(',')
              const topKeys = Object.keys(data).filter(k => k !== 'message').join(',')
              console.log(`[stream:${traceId}] #${rawEventCount} keys=[${topKeys}] msg_keys=[${msgKeys}] content=${JSON.stringify((token || '').slice(0,100))} thinking=${data.message?.thinking ? 'YES:' + JSON.stringify(String(data.message.thinking).slice(0,60)) : 'no'} done=${!!data.done}`)
            }
            // Filter <think>...</think> content from streamed UI output
            if (token) {
              if (dropAfterTemplateMarker) token = ''
              if (inThinkBlock) {
                const endIdx = token.indexOf('</think>')
                if (endIdx === -1) {
                  token = ''
                } else {
                  token = token.slice(endIdx + 8)
                  inThinkBlock = false
                }
              }
              const startIdx = token.indexOf('<think>')
              if (startIdx !== -1) {
                const endIdx = token.indexOf('</think>', startIdx + 7)
                if (endIdx !== -1) {
                  token = token.slice(0, startIdx) + token.slice(endIdx + 8)
                } else {
                  token = token.slice(0, startIdx)
                  inThinkBlock = true
                }
              }
              token = token.replace(/<\/?think>/gi, '')
              const marker = token.match(/<[^>\n]*(?:\|?im[_ ]?start\|?|\|?im[_ ]?end\|?|\|?endoftext\|?)[^>\n]*>/i)
              if (marker?.index != null) {
                token = token.slice(0, marker.index)
                dropAfterTemplateMarker = true
              }
            }
            if (token) yield { token, done: false }
            if (data.done) yield { token: '', done: true }
          } catch {}
        }
      } else if (provider === 'openai') {
        // OpenAI: SSE with data: lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { yield { token: '', done: true }; continue }
          try {
            const data = JSON.parse(payload)
            const token = data.choices?.[0]?.delta?.content || ''
            if (token) yield { token, done: false }
          } catch {}
        }
      } else if (provider === 'anthropic') {
        // Anthropic: SSE with event types
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'content_block_delta') {
              const token = data.delta?.text || ''
              if (token) yield { token, done: false }
            } else if (data.type === 'message_stop') {
              yield { token: '', done: true }
            }
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ── Compile ─────────────────────────────────────────────────────────────────

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

// ── Approved Model Lists ────────────────────────────────────────────────────

const OPENAI_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
]

const ANTHROPIC_MODELS = [
  'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4', 'claude-sonnet-4',
]

// ── HTTP Server ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Expose-Headers', 'X-Validation')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const parsed = url.parse(req.url, true)
  const pathname = parsed.pathname

  // ── Health ──────────────────────────────────────────────────────────────

  if (pathname === '/api/health' && req.method === 'GET') {
    let extopenscadOk = false
    try { execSync(`${EXTOPENSCAD} --help 2>&1`, { timeout: 5000 }); extopenscadOk = true } catch {}
    const ollamaReachable = await isOllamaReachable()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      extopenscad: EXTOPENSCAD,
      extopenscadOk,
      admeshOk: !!ADMESH,
      workspace: WORKSPACE,
      activeProvider: activeConfig.provider,
      activeModel: activeConfig.model,
      ollamaUrl: OLLAMA_URL,
      ollamaReachable,
      openaiKeySet: !!OPENAI_API_KEY,
      anthropicKeySet: !!ANTHROPIC_API_KEY,
    }))
    return
  }

  // ── Compile ─────────────────────────────────────────────────────────────

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

  // ── Chat (non-streaming, backward compatible) ───────────────────────────

  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      if (!body.prompt?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'Prompt required' })); return }

      // Build messages first, THEN update thread (avoids duplicating current prompt)
      const messages = buildMessages(body.prompt, body.code, body.sessionId)
      updateThread(body.sessionId, body.prompt.trim())
      let raw

      if (activeConfig.provider === 'cli') {
        // Legacy CLI path — flatten messages to single string
        let fullPrompt = ''
        for (const m of messages) {
          if (m.role === 'system') fullPrompt += m.content + '\n\n'
          else if (m.role === 'user') fullPrompt += `User: ${m.content}\n\n`
          else fullPrompt += `Assistant: ${m.content}\n\n`
        }
        fullPrompt += 'Generate the OpenSCAD code:'
        raw = await callLLMCli(fullPrompt)
      } else {
        raw = await routeInference(messages, false)
      }

      const code = extractCode(raw, body.code, body.prompt)
      if (!code) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Empty LLM response', raw: (raw || '').slice(0, 500) }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code, message: 'Code generated' }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message, hint: `Provider: ${activeConfig.provider}, Model: ${activeConfig.model}` }))
    }
    return
  }

  // ── Chat Stream (SSE) ──────────────────────────────────────────────────

  if (pathname === '/api/chat/stream' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      if (!body.prompt?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'Prompt required' })); return }

      const traceId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

      // Build messages first, THEN update thread (avoids duplicating current prompt)
      const messages = buildMessages(body.prompt, body.code, body.sessionId)
      updateThread(body.sessionId, body.prompt.trim())

      // Debug: log request and packed messages
      if (process.env.DEBUG_LLM_STREAM === '1') {
        console.log(`[req:${traceId}] sessionId=${body.sessionId || 'default'} model=${activeConfig.model} prompt_len=${body.prompt.length} code_len=${(body.code || '').length} packed_msgs=${messages.length} thread_context=${threadContextEnabled() ? 'on' : 'off'}`)
        for (const m of messages) {
          console.log(`  [req:${traceId}] [${m.role}] (${m.content.length} chars) ${m.content.slice(0, 120).replace(/\n/g, '\\n')}...`)
        }
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      // Handle client disconnect
      let aborted = false
      req.on('close', () => { aborted = true })

      if (activeConfig.provider === 'cli') {
        // CLI fallback: non-streaming, send as single SSE event
        // Use buildMessages for budgeting, then flatten
        let fullPrompt = ''
        for (const m of messages) {
          if (m.role === 'system') fullPrompt += m.content + '\n\n'
          else if (m.role === 'user') fullPrompt += `User: ${m.content}\n\n`
          else fullPrompt += `Assistant: ${m.content}\n\n`
        }
        fullPrompt += 'Generate the OpenSCAD code:'
        const raw = await callLLMCli(fullPrompt)
        const code = extractCode(raw, body.code, body.prompt)
        res.write(`data: ${JSON.stringify({ token: raw, done: false })}\n\n`)
        res.write(`data: ${JSON.stringify({ token: '', done: true, code })}\n\n`)
        res.end()
        return
      }

      const providerStream = await routeInference(messages, true)
      let accumulated = ''
      let sentDone = false
      const echoState = {
        enabled: !!body.code?.trim(),
        remaining: body.code?.trim()
          ? `Current code:\n\`\`\`\n${body.code.trim()}\n\`\`\`\n\n${body.prompt.trim()}`
          : '',
      }

      for await (const event of normalizeStream(providerStream, activeConfig.provider, traceId)) {
        if (aborted) break
        if (event.done) {
          const code = extractCode(accumulated, body.code, body.prompt)
          if (process.env.DEBUG_LLM_STREAM === '1') {
            console.log(`[done:${traceId}] accumulated_len=${accumulated.length} extracted_code_len=${code?.length || 0}`)
            console.log(`[done:${traceId}] first 300 chars: ${accumulated.slice(0, 300).replace(/\n/g, '\\n')}`)
          }
          res.write(`data: ${JSON.stringify({ token: '', done: true, code })}\n\n`)
          sentDone = true
        } else {
          accumulated += event.token
          const visibleToken = consumeLeadingEcho(event.token, echoState)
          if (visibleToken) {
            res.write(`data: ${JSON.stringify({ token: visibleToken, done: false })}\n\n`)
          }
        }
      }

      // If stream ended without a done event, send one
      if (!aborted && !sentDone && accumulated) {
        const code = extractCode(accumulated, body.code, body.prompt)
        res.write(`data: ${JSON.stringify({ token: '', done: true, code })}\n\n`)
      }

      res.end()
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      } else {
        res.write(`data: ${JSON.stringify({ error: e.message, done: true })}\n\n`)
        res.end()
      }
    }
    return
  }

  // ── Thread: Reset (clear server-side session memory) ─────────────────

  if (pathname === '/api/chat/reset' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      if (body.sessionId) {
        threadState.delete(body.sessionId)
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    }
    return
  }

  // ── Provider: Get Active ───────────────────────────────────────────────

  if (pathname === '/api/providers/active' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(activeConfig))
    return
  }

  // ── Provider: Select ──────────────────────────────────────────────────

  if (pathname === '/api/providers/select' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req)
      if (!body.provider || !body.model) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'provider and model required' }))
        return
      }
      activeConfig = { provider: body.provider, model: body.model }
      saveProviderConfig(activeConfig)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(activeConfig))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // ── Provider: List Models ─────────────────────────────────────────────

  if (pathname === '/api/providers/models' && req.method === 'GET') {
    const provider = parsed.query.provider || activeConfig.provider
    let models = []

    if (provider === 'ollama') {
      const allModels = await listOllamaModels()
      // App-facing view: only implicitcad-* models, strip :latest suffix to avoid duplicates
      models = [...new Set(
        allModels
          .filter(m => m.name.startsWith('implicitcad'))
          .map(m => m.name.replace(/:latest$/, ''))
      )]
    } else if (provider === 'openai') {
      models = OPENAI_MODELS
    } else if (provider === 'anthropic') {
      models = ANTHROPIC_MODELS
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ provider, models }))
    return
  }

  // ── Provider: Status ──────────────────────────────────────────────────

  if (pathname === '/api/providers/status' && req.method === 'GET') {
    const ollamaReachable = await isOllamaReachable()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      active: activeConfig,
      ollamaReachable,
      openaiKeySet: !!OPENAI_API_KEY,
      anthropicKeySet: !!ANTHROPIC_API_KEY,
    }))
    return
  }

  // ── Provider: Set API Keys ──────────────────────────────────────────

  if (pathname === '/api/providers/keys' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody(req)
      if (typeof body.openaiKey === 'string') OPENAI_API_KEY = body.openaiKey.trim()
      if (typeof body.anthropicKey === 'string') ANTHROPIC_API_KEY = body.anthropicKey.trim()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        openaiKeySet: !!OPENAI_API_KEY,
        anthropicKeySet: !!ANTHROPIC_API_KEY,
      }))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

// ── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, async () => {
  await autoDetectModel()
  console.log('')
  console.log('┌──────────────────────────────────────────────────┐')
  console.log('│        ImplicitCAD Studio — Server                │')
  console.log('├──────────────────────────────────────────────────┤')
  console.log(`│  API:         http://localhost:${PORT}                │`)
  console.log(`│  extopenscad: ${EXTOPENSCAD.slice(0, 36).padEnd(36)}│`)
  console.log(`│  Provider:    ${(activeConfig.provider + ' / ' + activeConfig.model).slice(0, 36).padEnd(36)}│`)
  console.log(`│  Ollama URL:  ${OLLAMA_URL.slice(0, 36).padEnd(36)}│`)
  console.log(`│  Workspace:   ${WORKSPACE.slice(0, 36).padEnd(36)}│`)
  console.log('├──────────────────────────────────────────────────┤')
  console.log('│  POST /api/compile         — .scad → STL        │')
  console.log('│  POST /api/chat            — AI (non-streaming)  │')
  console.log('│  POST /api/chat/stream     — AI (SSE streaming)  │')
  console.log('│  GET  /api/providers/active — active config       │')
  console.log('│  POST /api/providers/select — set provider/model  │')
  console.log('│  GET  /api/providers/models — list models         │')
  console.log('│  GET  /api/providers/status — diagnostics         │')
  console.log('│  GET  /api/health          — status check         │')
  console.log('└──────────────────────────────────────────────────┘')
  console.log('')
})
