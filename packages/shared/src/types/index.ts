// User types
export interface User {
    id: string
    email: string | null
    phone: string | null
    fullName: string
    avatarUrl: string | null
    bio: string | null
    status: 'online' | 'offline' | 'away'
    lastSeen: string | null
    createdAt: string
}

// Message types
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice'

export interface MessageContent {
    text?: string
    mediaUrl?: string
    thumbnail?: string
    fileName?: string
    fileSize?: number
    duration?: number
}

export interface Message {
    id: string
    conversationId: string
    senderId: string
    type: MessageType
    content: MessageContent
    replyTo?: string
    reactions: Reaction[]
    readBy: ReadReceipt[]
    isDeleted: boolean
    createdAt: string
}

export interface Reaction {
    userId: string
    emoji: string
}

export interface ReadReceipt {
    userId: string
    readAt: string
}

// Conversation types
export type ConversationType = 'private' | 'group'
export type ParticipantRole = 'admin' | 'member'

export interface Participant {
    userId: string
    role: ParticipantRole
    joinedAt: string
    lastRead?: string
    // Populated user info
    fullName?: string
    avatarUrl?: string
    status?: 'online' | 'offline'
}

export interface LastMessage {
    content: string
    type: string
    senderId: string
    timestamp: string
}

export interface Conversation {
    id: string
    type: ConversationType
    name?: string
    avatar?: string
    participants: Participant[]
    lastMessage?: LastMessage
    unreadCount: number
    createdAt: string
    updatedAt: string
}

// API Response types
export interface ApiResponse<T> {
    success: boolean
    data?: T
    message?: string
    error?: string
}

// Socket event types
export interface ChatSendEvent {
    conversationId: string
    type: MessageType
    content: MessageContent
    replyTo?: string
}

export interface ChatTypingEvent {
    conversationId: string
    userId: string
}

export interface ChatReadEvent {
    conversationId: string
    messageId: string
    userId: string
}

export interface CallInitiateEvent {
    to: string
    type: 'voice' | 'video'
    offer: RTCSessionDescriptionInit
}

export interface CallAcceptEvent {
    to: string
    answer: RTCSessionDescriptionInit
}

// Utility types
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
