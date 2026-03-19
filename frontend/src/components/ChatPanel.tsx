import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Copy, ArrowUpRight, ArrowDown } from 'lucide-react'
import { useChatStore, type ChatMessage } from '../stores/chatStore'
import { useEditorStore } from '../stores/editorStore'

export function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const addMessage = useChatStore((s) => s.addMessage)
  const setLoading = useChatStore((s) => s.setLoading)
  const code = useEditorStore((s) => s.code)
  const setCode = useEditorStore((s) => s.setCode)
  const log = useEditorStore((s) => s.log)

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
  }, [messages, isLoading, isNearBottom])

  const scrollToBottom = () => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
    setHasNewMessages(false)
  }

  const send = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    addMessage({ role: 'user', text })
    setLoading(true)

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, code, history: messages.slice(-8).map((m) => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.code || m.text })) }),
      })
      const data = await resp.json()

      if (data.error) {
        addMessage({ role: 'ai', text: data.error + (data.hint ? '\n\n' + data.hint : '') })
        log('AI: ' + data.error, 'error')
      } else if (data.code) {
        addMessage({ role: 'ai', text: 'Code generated:', code: data.code })
        log('AI generated code', 'success')
      } else {
        addMessage({ role: 'ai', text: 'Empty response. Try rephrasing.' })
      }
    } catch (e: unknown) {
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

  const applyCode = (c: string) => {
    setCode(c)
    log('Applied AI code to editor. Press Ctrl+Z / Cmd+Z to undo.', 'success')
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
      <div ref={messagesRef} onScroll={checkNearBottom} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {messages.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-muted text-center px-5">
            <div className="w-12 h-12 rounded-full bg-ai-dim flex items-center justify-center">
              <div className="text-ai opacity-80 text-xl font-bold">AI</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-text-primary">ImplicitCAD Assistant</div>
              <div className="text-xs text-text-secondary leading-relaxed">
                Describe a 3D model and I will generate the code.
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full mt-4">
              <button
                onClick={() => { setInput('Create a gear with 20 teeth and a 5mm center hole'); document.getElementById('chat-input')?.focus() }}
                className="text-left text-xs px-3 py-2 bg-bg-surface border border-border-default rounded-lg hover:border-ai/30 hover:bg-ai-dim transition-colors"
              >
                "Create a gear with 20 teeth..."
              </button>
              <button
                onClick={() => { setInput('Make a box with rounded corners (r=2)'); document.getElementById('chat-input')?.focus() }}
                className="text-left text-xs px-3 py-2 bg-bg-surface border border-border-default rounded-lg hover:border-ai/30 hover:bg-ai-dim transition-colors"
              >
                "Make a box with rounded corners..."
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onApply={applyCode} onCopy={copyCode} />
        ))}

        {isLoading && (
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
          className="absolute bottom-[70px] left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-ai text-white rounded-full shadow-md hover:brightness-110 transition-colors z-10"
        >
          <ArrowDown size={12} /> New messages
        </button>
      )}

      <div className="flex items-end gap-2 p-2.5 border-t border-border-default bg-bg-surface">
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Create a gear with 20 teeth..."
          rows={1}
          aria-label="Chat message input"
          className="flex-1 px-3 py-2 bg-bg-base border border-border-default rounded-[10px] text-text-primary text-sm font-[var(--font-ui)] resize-none outline-none min-h-[38px] max-h-[100px] transition-all focus-visible:border-ai focus-visible:ring-2 focus-visible:ring-ai-dim placeholder:text-text-faint"
        />
        <button
          onClick={send}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
          className="w-[38px] h-[38px] flex items-center justify-center bg-ai text-white rounded-[10px] shrink-0 transition-all hover:brightness-110 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ msg, onApply, onCopy }: { msg: ChatMessage; onApply: (c: string) => void; onCopy: (c: string, btn?: HTMLButtonElement) => void }) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex flex-col gap-1 max-w-[95%] animate-msg-in ${isUser ? 'self-end' : 'self-start'}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide px-0.5 ${isUser ? 'text-text-muted' : 'text-ai'}`}>
        {isUser ? 'You' : 'AI Assistant'}
      </div>
      <div className={`px-3 py-2 rounded-[10px] text-sm leading-relaxed ${
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
                onClick={() => onApply(msg.code!)}
                className="px-2.5 py-1 text-[11px] font-medium bg-ai text-white rounded-md hover:brightness-110 hover:shadow-sm transition-all"
              >
                <ArrowUpRight size={12} className="inline mr-1" />Apply to Editor
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
