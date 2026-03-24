"use client";

import { create } from 'zustand';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  blocks?: any[];
}

interface ChatSession {
  session_id: string;
  title: string;
}

interface ChatStore {
  sessions: ChatSession[];
  messages: Record<string, ChatMessage[]>;
  activeSessionId: string | null;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessions: [{ session_id: 'sess_1', title: '질환/약품 검색 기본 대화' }],
  messages: {
    'sess_1': []
  },
  activeSessionId: 'sess_1',
  setActiveSession: (id) => set({ activeSessionId: id }),
  addMessage: (sessionId, message) => set((state) => {
    const currentMsgs = state.messages[sessionId] || [];
    return {
      messages: {
        ...state.messages,
        [sessionId]: [...currentMsgs, message]
      }
    };
  })
}));