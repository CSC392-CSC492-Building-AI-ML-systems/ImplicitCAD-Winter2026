import { create } from 'zustand'
import { useEditorStore } from './editorStore'

export interface ChatMessage {
  id: string
  role: 'user' | 'ai' | 'system'
  text: string
  code?: string
}

export interface ProviderStatus {
  ollamaReachable: boolean
  openaiKeySet: boolean
  anthropicKeySet: boolean
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingText: string
}

function makeSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function makeMsgId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createSession(name?: string): ChatSession {
  return {
    id: makeSessionId(),
    name: name || 'New Chat',
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingText: '',
  }
}

/** Derive a short session name from the first user message */
function deriveSessionName(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= 24) return trimmed
  return trimmed.slice(0, 24) + '...'
}

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string
  activeProvider: string | null
  activeModel: string | null
  providerStatus: ProviderStatus | null
  providerError: string | null

  // Session management
  createNewSession: () => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void

  // Message actions (operate on active session)
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
  appendStreamToken: (token: string) => void
  finalizeStream: (code?: string | null) => void
  setLoading: (v: boolean) => void
  setStreaming: (v: boolean) => void
  clear: () => void

  // Provider actions (global)
  setActiveConfig: (provider: string, model: string) => void
  setProviderStatus: (status: ProviderStatus) => void
  fetchActiveConfig: () => Promise<void>
  selectProvider: (provider: string, model: string) => Promise<void>
  fetchProviderStatus: () => Promise<void>

  // Convenience selectors
  activeSession: () => ChatSession
}

const initialSession = createSession()

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [initialSession],
  activeSessionId: initialSession.id,
  activeProvider: null,
  activeModel: null,
  providerStatus: null,
  providerError: null,

  activeSession: () => {
    const s = get()
    return s.sessions.find(sess => sess.id === s.activeSessionId) || s.sessions[0]
  },

  // ── Session management ─────────────────────────────────────────────

  createNewSession: () => {
    const session = createSession()
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
    }))
  },

  deleteSession: (id) =>
    set((s) => {
      // Reset server-side thread memory for this session
      fetch('/api/chat/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      }).catch((e) => console.warn('Session reset failed:', e))

      if (s.sessions.length <= 1) {
        return {
          sessions: s.sessions.map(sess =>
            sess.id === id ? { ...sess, messages: [], streamingText: '', isLoading: false, isStreaming: false, name: 'New Chat' } : sess
          ),
        }
      }
      const remaining = s.sessions.filter(sess => sess.id !== id)
      const newActive = s.activeSessionId === id ? remaining[remaining.length - 1].id : s.activeSessionId
      return { sessions: remaining, activeSessionId: newActive }
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  // ── Message actions (active session) ───────────────────────────────

  addMessage: (msg) =>
    set((s) => ({
      sessions: s.sessions.map(sess => {
        if (sess.id !== s.activeSessionId) return sess
        const updated = {
          ...sess,
          messages: [...sess.messages, { ...msg, id: makeMsgId() }],
        }
        // Auto-name session from first user message
        if (msg.role === 'user' && sess.name === 'New Chat') {
          updated.name = deriveSessionName(msg.text)
        }
        return updated
      }),
    })),

  appendStreamToken: (token) =>
    set((s) => ({
      sessions: s.sessions.map(sess =>
        sess.id === s.activeSessionId
          ? { ...sess, streamingText: sess.streamingText + token }
          : sess
      ),
    })),

  finalizeStream: (code) =>
    set((s) => ({
      sessions: s.sessions.map(sess => {
        if (sess.id !== s.activeSessionId) return sess
        if (code === null) {
          return { ...sess, streamingText: '', isStreaming: false }
        }
        const text = sess.streamingText || (code ? 'Code generated:' : 'Empty response.')
        return {
          ...sess,
          messages: [...sess.messages, {
            id: makeMsgId(),
            role: 'ai' as const,
            text: code ? 'Code generated:' : text,
            code: code || undefined,
          }],
          streamingText: '',
          isStreaming: false,
        }
      }),
    })),

  setLoading: (isLoading) =>
    set((s) => ({
      sessions: s.sessions.map(sess =>
        sess.id === s.activeSessionId ? { ...sess, isLoading } : sess
      ),
    })),

  setStreaming: (isStreaming) =>
    set((s) => ({
      sessions: s.sessions.map(sess =>
        sess.id === s.activeSessionId
          ? { ...sess, isStreaming, streamingText: isStreaming ? '' : sess.streamingText }
          : sess
      ),
    })),

  clear: () =>
    set((s) => {
      // Reset server-side thread memory
      fetch('/api/chat/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: s.activeSessionId }),
      }).catch((e) => console.warn('Session reset failed:', e))
      return {
        sessions: s.sessions.map(sess =>
          sess.id === s.activeSessionId
            ? { ...sess, messages: [], streamingText: '' }
            : sess
        ),
      }
    }),

  // ── Provider actions (global) ──────────────────────────────────────

  setActiveConfig: (provider, model) => set({ activeProvider: provider, activeModel: model }),
  setProviderStatus: (providerStatus) => set({ providerStatus }),

  fetchActiveConfig: async () => {
    try {
      const resp = await fetch('/api/providers/active')
      if (!resp.ok) return
      const data = await resp.json()
      set({ activeProvider: data.provider, activeModel: data.model, providerError: null })
    } catch {
      useEditorStore.getState().log('Failed to load AI provider config', 'warning')
      set({ providerError: 'Cannot reach server' })
    }
  },

  selectProvider: async (provider, model) => {
    try {
      const resp = await fetch('/api/providers/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      })
      if (!resp.ok) return
      const data = await resp.json()
      set({ activeProvider: data.provider, activeModel: data.model, providerError: null })
    } catch {
      const msg = 'Failed to switch AI provider'
      useEditorStore.getState().log(msg, 'error')
      useEditorStore.getState().addToast(msg, 'error')
      set({ providerError: msg })
    }
  },

  fetchProviderStatus: async () => {
    try {
      const resp = await fetch('/api/providers/status')
      if (!resp.ok) return
      const data = await resp.json()
      set({
        providerStatus: {
          ollamaReachable: data.ollamaReachable,
          openaiKeySet: data.openaiKeySet,
          anthropicKeySet: data.anthropicKeySet,
        },
        activeProvider: data.active?.provider,
        activeModel: data.active?.model,
        providerError: null,
      })
    } catch {
      set({ providerError: 'Cannot reach server' })
    }
  },
}))
