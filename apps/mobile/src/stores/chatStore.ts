import { create } from "zustand";
import type { Message, Conversation } from "@/types";

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  typingUsers: Record<string, string[]>; // conversationId -> userIds
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (conversation: Conversation | null) => void;

  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updates: Partial<Message>,
  ) => void;

  addTypingUser: (conversationId: string, userId: string) => void;
  removeTypingUser: (conversationId: string, userId: string) => void;

  setLoadingConversations: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;

  // Helpers
  getMessagesForConversation: (id: string) => Message[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: {},
  typingUsers: {},
  isLoadingConversations: false,
  isLoadingMessages: false,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
      activeConversation:
        state.activeConversation?.id === id
          ? { ...state.activeConversation, ...updates }
          : state.activeConversation,
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversation:
        state.activeConversation?.id === id ? null : state.activeConversation,
    })),

  setActiveConversation: (conversation) =>
    set({ activeConversation: conversation }),

  setMessages: (conversationId, messages) =>
    set((state) => {
      const deduped: Message[] = [];
      const seen = new Set<string>();
      for (const message of messages || []) {
        const id = String(message?.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        deduped.push(message);
      }
      return {
        messages: { ...state.messages, [conversationId]: deduped },
      };
    }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const current = state.messages[conversationId] || [];
      const incomingId = String(message?.id || "");
      if (!incomingId) return state;

      const existed = current.some((m) => String(m?.id || "") === incomingId);
      if (existed) return state;

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...current, message],
        },
      };
    }),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => {
      const current = state.messages[conversationId] || [];
      const updatedList = current.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m,
      );

      const deduped: Message[] = [];
      const seen = new Set<string>();
      for (const message of updatedList) {
        const id = String(message?.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        deduped.push(message);
      }

      return {
        messages: {
          ...state.messages,
          [conversationId]: deduped,
        },
      };
    }),

  addTypingUser: (conversationId, userId) =>
    set((state) => {
      const current = state.typingUsers[conversationId] || [];
      if (current.includes(userId)) return state;
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: [...current, userId],
        },
      };
    }),

  removeTypingUser: (conversationId, userId) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: (state.typingUsers[conversationId] || []).filter(
          (id) => id !== userId,
        ),
      },
    })),

  setLoadingConversations: (isLoadingConversations) =>
    set({ isLoadingConversations }),
  setLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),

  getMessagesForConversation: (id) => get().messages[id] || [],
}));
