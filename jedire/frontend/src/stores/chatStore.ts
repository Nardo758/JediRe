import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  agent_name?: string;
  metadata?: {
    properties?: any[];
    suggested_actions?: string[];
  };
  created_at: string;
}

interface ChatState {
  messages: Message[];
  conversationId: string | null;
  isTyping: boolean;
  chatExpanded: boolean;
  
  // Actions
  addMessage: (message: Message) => void;
  setTyping: (isTyping: boolean) => void;
  toggleChat: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversationId: null,
  isTyping: false,
  chatExpanded: false,
  
  addMessage: (message) => 
    set((state) => ({ messages: [...state.messages, message] })),
  setTyping: (isTyping) => set({ isTyping }),
  toggleChat: () => set((state) => ({ chatExpanded: !state.chatExpanded })),
  clearMessages: () => set({ messages: [], conversationId: null }),
}));
