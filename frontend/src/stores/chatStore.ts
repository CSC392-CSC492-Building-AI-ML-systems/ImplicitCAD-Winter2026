import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'ai' | 'system'
  text: string
  code?: string
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
  setLoading: (v: boolean) => void
  clear: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}` }],
    })),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ messages: [] }),
}))
