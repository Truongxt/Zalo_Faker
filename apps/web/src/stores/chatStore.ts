import { create } from 'zustand'

export interface Message {
    id: string
    conversationId: string
    senderId: string
    type: 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice'
    content: {
        text?: string
        mediaUrl?: string
        thumbnail?: string
        fileName?: string
        fileSize?: number
        duration?: number
    }
    replyTo?: string
    reactions: { userId: string; emoji: string }[]
    readBy: { userId: string; readAt: string }[]
    isDeleted: boolean
    createdAt: string
}

export interface Participant {
    userId: string
    role: 'admin' | 'member'
    joinedAt: string
    lastRead?: string
    // User info (populated)
    fullName?: string
    avatarUrl?: string
    status?: 'online' | 'offline'
}

export interface Conversation {
    id: string
    type: 'private' | 'group'
    name?: string
    avatar?: string
    participants: Participant[]
    lastMessage?: {
        content: string
        type: string
        senderId: string
        timestamp: string
    }
    unreadCount: number
    createdAt: string
    updatedAt: string
}

interface ChatState {
    conversations: Conversation[]
    activeConversation: Conversation | null
    messages: Record<string, Message[]>  // conversationId -> messages
    typingUsers: Record<string, string[]>  // conversationId -> userIds
    isLoadingConversations: boolean
    isLoadingMessages: boolean

    // Actions
    setConversations: (conversations: Conversation[]) => void
    addConversation: (conversation: Conversation) => void
    updateConversation: (id: string, updates: Partial<Conversation>) => void
    removeConversation: (id: string) => void
    setActiveConversation: (conversation: Conversation | null) => void

    setMessages: (conversationId: string, messages: Message[]) => void
    addMessage: (conversationId: string, message: Message) => void
    updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void
    removeMessage: (conversationId: string, messageId: string) => void

    setTypingUsers: (conversationId: string, userIds: string[]) => void
    addTypingUser: (conversationId: string, userId: string) => void
    removeTypingUser: (conversationId: string, userId: string) => void

    setLoadingConversations: (loading: boolean) => void
    setLoadingMessages: (loading: boolean) => void

    // Helpers
    getConversationById: (id: string) => Conversation | undefined
    getMessagesForConversation: (id: string) => Message[]
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: [],
    activeConversation: null,
    messages: {},
    typingUsers: {},
    isLoadingConversations: false,
    isLoadingMessages: false,

    setConversations: (conversations) => set({ conversations }),

    addConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations]
    })),

    updateConversation: (id, updates) => set((state) => ({
        conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updates } : c
        ),
        activeConversation: state.activeConversation?.id === id
            ? { ...state.activeConversation, ...updates }
            : state.activeConversation
    })),

    removeConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversation: state.activeConversation?.id === id
            ? null
            : state.activeConversation
    })),

    setActiveConversation: (conversation) => set({ activeConversation: conversation }),

    setMessages: (conversationId, messages) => set((state) => ({
        messages: { ...state.messages, [conversationId]: messages }
    })),

    addMessage: (conversationId, message) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: [...(state.messages[conversationId] || []), message]
        }
    })),

    updateMessage: (conversationId, messageId, updates) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
            )
        }
    })),

    removeMessage: (conversationId, messageId) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).filter(
                (m) => m.id !== messageId
            )
        }
    })),

    setTypingUsers: (conversationId, userIds) => set((state) => ({
        typingUsers: { ...state.typingUsers, [conversationId]: userIds }
    })),

    addTypingUser: (conversationId, userId) => set((state) => {
        const current = state.typingUsers[conversationId] || []
        if (current.includes(userId)) return state
        return {
            typingUsers: { ...state.typingUsers, [conversationId]: [...current, userId] }
        }
    }),

    removeTypingUser: (conversationId, userId) => set((state) => ({
        typingUsers: {
            ...state.typingUsers,
            [conversationId]: (state.typingUsers[conversationId] || []).filter(
                (id) => id !== userId
            )
        }
    })),

    setLoadingConversations: (isLoadingConversations) => set({ isLoadingConversations }),
    setLoadingMessages: (isLoadingMessages) => set({ isLoadingMessages }),

    getConversationById: (id) => get().conversations.find((c) => c.id === id),
    getMessagesForConversation: (id) => get().messages[id] || [],
}))
