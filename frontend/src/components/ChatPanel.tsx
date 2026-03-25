import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Copy, GitCompareArrows, ArrowDown, KeyRound, Plus, X as XIcon, MessageSquare } from 'lucide-react'
import { useChatStore, type ChatMessage } from '../stores/chatStore'
import { useEditorStore } from '../stores/editorStore'
import { ApiKeysDialog } from './ApiKeysDialog'

const PROVIDERS = [
  { value: 'ollama', label: 'Local Ollama' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Claude' },
]

export function ChatPanel() {
  const [input, setInput] = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [showApiKeys, setShowApiKeys] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

  // Session state
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const createNewSession = useChatStore((s) => s.createNewSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const setActiveSession = useChatStore((s) => s.setActiveSession)

  // Active session data
  const activeSession = useChatStore((s) => s.activeSession())
  const messages = activeSession.messages
  const isLoading = activeSession.isLoading
  const isStreaming = activeSession.isStreaming
  const streamingText = activeSession.streamingText

  // Actions
  const addMessage = useChatStore((s) => s.addMessage)
  const setLoading = useChatStore((s) => s.setLoading)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const appendStreamToken = useChatStore((s) => s.appendStreamToken)
  const finalizeStream = useChatStore((s) => s.finalizeStream)

  // Provider state
  const activeProvider = useChatStore((s) => s.activeProvider)
  const activeModel = useChatStore((s) => s.activeModel)
  const providerStatus = useChatStore((s) => s.providerStatus)
  const fetchActiveConfig = useChatStore((s) => s.fetchActiveConfig)
  const selectProvider = useChatStore((s) => s.selectProvider)
  const fetchProviderStatus = useChatStore((s) => s.fetchProviderStatus)

  // Editor state
  const code = useEditorStore((s) => s.code)
  const pendingDiff = useEditorStore((s) => s.pendingDiff)
  const setPendingDiff = useEditorStore((s) => s.setPendingDiff)
  const log = useEditorStore((s) => s.log)

  // Fetch provider config and status on mount
  useEffect(() => {
    fetchActiveConfig()
    fetchProviderStatus()
    const interval = setInterval(fetchProviderStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchActiveConfig, fetchProviderStatus])

  // Fetch available models when provider changes
  useEffect(() => {
    if (!activeProvider) return
    fetch(`/api/providers/models?provider=${activeProvider}`)
      .then(r => r.json())
      .then(data => setAvailableModels(data.models || []))
      .catch(() => setAvailableModels([]))
  }, [activeProvider])

  const handleProviderChange = (newProvider: string) => {
    fetch(`/api/providers/models?provider=${newProvider}`)
      .then(r => r.json())
      .then(data => {
        const models = data.models || []
        setAvailableModels(models)
        const model = models[0] || ''
        if (model) selectProvider(newProvider, model)
      })
      .catch(() => {})
  }

  const handleModelChange = (newModel: string) => {
    if (activeProvider) selectProvider(activeProvider, newModel)
  }

  const getStatusIndicator = () => {
    if (!providerStatus) return { color: 'bg-text-muted', label: 'Loading...' }
    if (activeProvider === 'ollama') {
      return providerStatus.ollamaReachable
        ? { color: 'bg-success', label: 'Ready' }
        : { color: 'bg-error', label: 'Unreachable' }
    }
    if (activeProvider === 'openai') {
      return providerStatus.openaiKeySet
        ? { color: 'bg-success', label: 'Key set' }
        : { color: 'bg-error', label: 'No API key' }
    }
    if (activeProvider === 'anthropic') {
      return providerStatus.anthropicKeySet
        ? { color: 'bg-success', label: 'Key set' }
        : { color: 'bg-error', label: 'No API key' }
    }
    return { color: 'bg-text-muted', label: 'Unknown' }
  }

  const status = getStatusIndicator()

  const [isNearBottom, setIsNearBottom] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)

  const checkNearBottom = useCallback(() => {
    const el = messagesRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setIsNearBottom(near)
    if (near) setHasNewMessages(false)
  }, [])

  useEffect(() => {
    if (isNearBottom) {
      messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight)
    } else {
      setHasNewMessages(true)
    }
  }, [messages, isLoading, isStreaming, streamingText, isNearBottom])

  // Scroll to bottom when switching sessions
  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight)
  }, [activeSessionId])

  const scrollToBottom = () => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
    setHasNewMessages(false)
  }

  const autoReview = (generatedCode: string, prompt: string) => {
    if (!generatedCode) return false
    if (pendingDiff) return false
    setPendingDiff({ original: code, proposed: generatedCode, prompt })
    log('Review AI changes in the editor. Accept or Reject.', 'info')
    return true
  }

  const send = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    addMessage({ role: 'user', text })
    setLoading(true)
    setStreaming(true)

    try {
      const resp = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          prompt: text,
          code,
        }),
      })

      const contentType = resp.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        const reader = resp.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalized = false

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              try {
                const data = JSON.parse(line.slice(6))
                if (data.error) {
                  addMessage({ role: 'ai', text: data.error })
                  log('AI: ' + data.error, 'error')
                  setStreaming(false)
                  finalized = true
                  break
                }
                if (data.done && !finalized) {
                  finalized = true
                  if (data.code) {
                    const didAutoReview = autoReview(data.code, text)
                    // Always show the code in chat history
                    finalizeStream(null)
                    addMessage({
                      role: 'ai',
                      text: didAutoReview
                        ? 'I drafted a change — review it in the editor.'
                        : 'Code generated:',
                      code: data.code,
                    })
                    log('AI generated code', 'success')
                  } else {
                    finalizeStream()
                  }
                } else if (data.token) {
                  // Don't show raw streaming tokens — model output is often messy
                  // (prompt echo, thinking text, template artifacts).
                  // Only the final extracted code (data.code on done) is shown to the user.
                }
              } catch {}
            }
          }
        }
      } else {
        // JSON fallback (non-streaming)
        setStreaming(false)
        const data = await resp.json()
        if (data.error) {
          addMessage({ role: 'ai', text: data.error + (data.hint ? '\n\n' + data.hint : '') })
          log('AI: ' + data.error, 'error')
        } else if (data.code) {
          const didAutoReview = autoReview(data.code, text)
          addMessage({
            role: 'ai',
            text: didAutoReview
              ? 'I drafted a change — review it in the editor.'
              : 'Code generated:',
            code: data.code,
          })
          log('AI generated code', 'success')
        } else {
          addMessage({ role: 'ai', text: 'Empty response. Try rephrasing.' })
        }
      }
    } catch (e: unknown) {
      setStreaming(false)
      addMessage({ role: 'ai', text: `Server error: ${e instanceof Error ? e.message : e}\n\nMake sure the server is running.` })
      log('Chat error', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const reviewCode = (c: string, prompt: string) => {
    if (pendingDiff) {
      log('Review pending changes in the editor first.', 'warning')
      return
    }
    setPendingDiff({ original: code, proposed: c, prompt })
    log('Review AI changes in the editor. Accept or Reject.', 'info')
  }

  const copyCode = async (c: string, btnEl?: HTMLButtonElement) => {
    await navigator.clipboard.writeText(c)
    if (btnEl) {
      const prev = btnEl.textContent
      btnEl.textContent = 'Copied!'
      setTimeout(() => { btnEl.textContent = prev }, 1500)
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-base relative">
      {/* Provider bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border-default bg-bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={activeProvider || ''}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="text-xs bg-bg-base border border-border-default rounded-md px-2 py-1 text-text-primary outline-none transition-all duration-150 hover:bg-bg-raised hover:border-border-strong focus-visible:border-ai focus-visible:ring-2 focus-visible:ring-ai-dim cursor-pointer"
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={activeModel || ''}
            onChange={(e) => handleModelChange(e.target.value)}
            className="text-xs bg-bg-base border border-border-default rounded-md px-2 py-1 text-text-primary outline-none transition-all duration-150 hover:bg-bg-raised hover:border-border-strong focus-visible:border-ai focus-visible:ring-2 focus-visible:ring-ai-dim cursor-pointer max-w-[160px]"
          >
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
            {activeModel && !availableModels.includes(activeModel) && (
              <option value={activeModel}>{activeModel}</option>
            )}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className={`w-2 h-2 rounded-full ${status.color} shrink-0`} />
            {status.label}
          </div>
          <button
            onClick={() => setShowApiKeys(true)}
            aria-label="API Keys"
            title="Configure API keys"
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <KeyRound size={14} />
          </button>
        </div>
      </div>

      {/* Session tabs */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border-default bg-bg-base shrink-0 overflow-x-auto">
        {sessions.map((sess) => (
          <div
            key={sess.id}
            className={`group flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
              sess.id === activeSessionId
                ? 'border-ai/30 bg-ai-dim text-text-primary'
                : 'border-transparent bg-transparent text-text-muted hover:bg-bg-hover hover:text-text-secondary'
            }`}
          >
            <button
              onClick={() => setActiveSession(sess.id)}
              className="flex items-center gap-1.5 min-w-0"
              title={sess.name}
            >
              <MessageSquare size={11} className={sess.id === activeSessionId ? 'text-ai' : 'text-text-faint'} />
              <span className="max-w-[14ch] truncate">{sess.name}</span>
            </button>
            {sessions.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(sess.id) }}
                aria-label={`Close ${sess.name}`}
                className="rounded p-0.5 text-text-faint opacity-0 group-hover:opacity-70 transition hover:bg-bg-hover hover:text-text-primary"
              >
                <XIcon size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={createNewSession}
          aria-label="New chat session"
          title="New chat"
          className="shrink-0 p-1 rounded-md text-text-muted hover:text-ai hover:bg-ai-dim transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {showApiKeys && <ApiKeysDialog onClose={() => setShowApiKeys(false)} />}

      {/* Messages */}
      <div ref={messagesRef} onScroll={checkNearBottom} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onReview={reviewCode} onCopy={copyCode} hasPendingDiff={!!pendingDiff} />
        ))}

        {isStreaming && streamingText && (
          <div className="flex flex-col gap-1 max-w-[95%] self-start animate-msg-in">
            <div className="text-[11px] font-semibold uppercase tracking-wide px-0.5 text-ai">
              AI Assistant
            </div>
            <div className="px-3 py-2 rounded-xl text-sm leading-relaxed bg-ai-dim border border-ai/15 text-text-primary rounded-bl-sm">
              <div className="whitespace-pre-wrap font-mono text-[11px]">
                {streamingText}
                <span className="inline-block w-[2px] h-[14px] bg-ai ml-0.5 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
          <div className="flex items-center gap-2 px-3 py-2 text-ai text-xs animate-msg-in">
            <div className="flex gap-[3px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-[5px] h-[5px] rounded-full bg-ai animate-typing-dot motion-reduce:animate-none" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            Generating code...
          </div>
        )}
      </div>

      {hasNewMessages && !isNearBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-[70px] left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-ai text-white rounded-full shadow-md hover:brightness-110 transition-colors z-[var(--z-panel)]"
        >
          <ArrowDown size={12} /> New messages
        </button>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 p-2.5 border-t border-border-default bg-bg-surface">
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a 3D model..."
          rows={1}
          aria-label="Chat message input"
          className="flex-1 px-3 py-2 bg-bg-base border border-border-default rounded-xl text-text-primary text-sm font-[var(--font-ui)] resize-none outline-none min-h-[38px] max-h-[100px] transition-all focus-visible:border-ai focus-visible:ring-2 focus-visible:ring-ai-dim placeholder:text-text-faint"
        />
        <button
          onClick={send}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="w-[38px] h-[38px] flex items-center justify-center bg-ai text-white rounded-xl shrink-0 transition-all hover:brightness-110 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ msg, onReview, onCopy, hasPendingDiff }: {
  msg: ChatMessage
  onReview: (c: string, prompt: string) => void
  onCopy: (c: string, btn?: HTMLButtonElement) => void
  hasPendingDiff: boolean
}) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex flex-col gap-1 max-w-[95%] animate-msg-in ${isUser ? 'self-end' : 'self-start'}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide px-0.5 ${isUser ? 'text-text-muted' : 'text-ai'}`}>
        {isUser ? 'You' : 'AI Assistant'}
      </div>
      <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
        isUser
          ? 'bg-bg-raised border border-border-default text-text-primary rounded-br-sm'
          : 'bg-ai-dim border border-ai/15 text-text-primary rounded-bl-sm'
      }`}>
        <div className="whitespace-pre-wrap">{msg.text}</div>
        {msg.code && (
          <>
            <pre className="mt-1.5 p-2.5 bg-bg-surface border border-border-default rounded-md font-mono text-[11px] leading-relaxed text-text-secondary max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
              {msg.code.length > 300 ? msg.code.slice(0, 300) + '...' : msg.code}
            </pre>
            <div className="flex gap-1.5 mt-1.5">
              <button
                onClick={() => onReview(msg.code!, msg.text)}
                disabled={hasPendingDiff}
                title={hasPendingDiff ? 'Review pending changes in the editor first' : 'Apply to editor as diff'}
                className="px-2.5 py-1 text-[11px] font-medium bg-ai text-white rounded-md hover:brightness-110 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GitCompareArrows size={12} className="inline mr-1" />Apply to Editor
              </button>
              <button
                onClick={(e) => onCopy(msg.code!, e.currentTarget)}
                className="px-2.5 py-1 text-[11px] font-medium bg-bg-base text-text-secondary border border-border-default rounded-md hover:text-text-primary hover:border-border-strong transition-all"
              >
                <Copy size={12} className="inline mr-1" />Copy
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
