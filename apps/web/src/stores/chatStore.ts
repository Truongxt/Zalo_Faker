import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const MAX_CACHED_CONVERSATIONS = 200
const MAX_CACHED_MESSAGES_PER_CONVERSATION = 120

export interface Label {
    _id: string
    userId: string
    name: string
    color: string
}

export interface PollOption {
    id: string
    text: string
    createdBy: string
    createdAt: string
}

export interface PollVote {
    userId: string
    optionIds: string[]
    votedAt: string
}

export interface PollSettings {
    anonymousVoters: boolean
    hideResultsUntilVote: boolean
    allowMultipleChoices: boolean
    allowAddOptions: boolean
    expiresAt: string | null
}

export interface MessageAttachment {
    url: string
    type: 'image' | 'video' | 'file' | 'voice'
    name?: string
    size?: number
    duration?: number
    thumbnailUrl?: string
}

export interface PollContent {
    question: string
    options: PollOption[]
    settings: PollSettings
    votes: PollVote[]
    createdBy: string
    createdAt: string
}

export interface Message {
    id: string
    conversationId: string
    senderId: string
    type: 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice' | 'call' | 'system' | 'poll'
    content: {
        text?: string
        mediaUrl?: string
        thumbnail?: string
        fileName?: string
        fileSize?: number
        duration?: number
        transcript?: string
        callType?: 'audio' | 'video'
        callStatus?: string
        poll?: PollContent
    }
    attachments?: MessageAttachment[]
    metadata?: {
        isAnnouncement?: boolean
        isImportant?: boolean
        isForwarded?: boolean
        forwardedFromMessageId?: string
        forwardedAt?: string
        folderId?: string
        folder?: string
        subfolder?: string
        transcript?: string
        transcriptStatus?: string
        transcriptUpdatedAt?: string
        transcriptProvider?: string
    } | null
    replyTo?: string
    reactions: { userId: string; emoji: string; userName?: string }[]
    readBy: { userId: string; readAt: string }[]
    isDeleted: boolean
    createdAt: string
    senderName?: string
    senderAvatar?: string
    // Added for helper
    lastRead?: string
}

type ParsedCallPayload = {
    callType: 'audio' | 'video'
    callStatus: string
    duration?: number
}

const normalizeCallType = (value: unknown): ParsedCallPayload['callType'] | undefined => {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'video') return 'video'
    if (normalized === 'audio' || normalized === 'voice') return 'audio'
    return undefined
}

const normalizeCallStatus = (value: unknown): string | undefined => {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return undefined
    if (normalized === 'ended') return 'finished'
    return normalized
}

const parseCallPayloadObject = (value: Record<string, unknown>): ParsedCallPayload | null => {
    const callType = normalizeCallType(value.callType)
    const callStatus = normalizeCallStatus(value.status || value.callStatus)
    if (!callType || !callStatus) return null

    const duration = typeof value.duration === 'number' && Number.isFinite(value.duration)
        ? Math.max(0, Math.floor(value.duration))
        : undefined

    return { callType, callStatus, duration }
}

const parseCallPayload = (value: unknown): ParsedCallPayload | null => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null

        try {
            const parsed = JSON.parse(trimmed)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
            return parseCallPayloadObject(parsed as Record<string, unknown>)
        } catch {
            return null
        }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) return null

    const direct = parseCallPayloadObject(value as Record<string, unknown>)
    if (direct) return direct

    const nestedText =
        typeof (value as Record<string, unknown>).text === 'string'
            ? (value as Record<string, unknown>).text
            : typeof (value as Record<string, unknown>).message === 'string'
                ? (value as Record<string, unknown>).message
                : typeof (value as Record<string, unknown>).content === 'string'
                    ? (value as Record<string, unknown>).content
                    : ''

    return nestedText ? parseCallPayload(nestedText) : null
}

const looksLikeMediaUrl = (value: string): boolean => {
    const normalized = value.trim()
    if (!normalized) return false

    if (/^https?:\/\//i.test(normalized)) return true
    if (/^data:image\//i.test(normalized)) return true
    if (/^blob:/i.test(normalized)) return true
    if (/^\/(uploads|images|media|stickers)\//i.test(normalized)) return true

    return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(normalized)
}

const normalizeMessageContent = (rawContent: unknown): Message['content'] => {
    const parsedCall = parseCallPayload(rawContent)

    if (
        rawContent
        && typeof rawContent === 'object'
        && !Array.isArray(rawContent)
        && (rawContent as Record<string, unknown>).poll
        && typeof (rawContent as Record<string, unknown>).poll === 'object'
        && !Array.isArray((rawContent as Record<string, unknown>).poll)
    ) {
        const poll = (rawContent as Record<string, unknown>).poll as PollContent
        return {
            poll,
            text: typeof (rawContent as Record<string, unknown>).text === 'string'
                ? String((rawContent as Record<string, unknown>).text)
                : typeof poll.question === 'string'
                    ? poll.question
                    : undefined,
        }
    }

    if (
        rawContent
        && typeof rawContent === 'object'
        && !Array.isArray(rawContent)
        && typeof (rawContent as Record<string, unknown>).question === 'string'
        && Array.isArray((rawContent as Record<string, unknown>).options)
    ) {
        return {
            poll: rawContent as PollContent,
            text: typeof (rawContent as Record<string, unknown>).question === 'string'
                ? String((rawContent as Record<string, unknown>).question)
                : undefined,
        }
    }

    if (typeof rawContent === 'string') {
        const mediaUrl = looksLikeMediaUrl(rawContent) ? rawContent : undefined
        return {
            text: mediaUrl ? undefined : rawContent,
            mediaUrl,
            callType: parsedCall?.callType,
            callStatus: parsedCall?.callStatus,
            duration: parsedCall?.duration,
        }
    }

    if (!rawContent || typeof rawContent !== 'object') {
        return {}
    }

    const content = rawContent as Record<string, unknown>

    const text =
        typeof content.text === 'string'
            ? content.text
            : typeof content.message === 'string'
                ? content.message
                : typeof content.content === 'string'
                    ? content.content
                    : undefined

    const mediaUrl =
        typeof content.mediaUrl === 'string'
            ? content.mediaUrl
            : typeof content.url === 'string'
                ? content.url
                : typeof content.fileUrl === 'string'
                    ? content.fileUrl
                    : undefined

    return {
        text,
        mediaUrl,
        thumbnail: typeof content.thumbnail === 'string' ? content.thumbnail : undefined,
        fileName: typeof content.fileName === 'string' ? content.fileName : undefined,
        fileSize: typeof content.fileSize === 'number' ? content.fileSize : undefined,
        duration: typeof content.duration === 'number'
            ? content.duration
            : parsedCall?.duration,
        transcript: typeof content.transcript === 'string' ? content.transcript : undefined,
        callType: parsedCall?.callType,
        callStatus: parsedCall?.callStatus,
    }
}

const normalizeMessageMetadata = (rawMetadata: unknown): Message['metadata'] => {
    if (!rawMetadata || typeof rawMetadata !== 'object') {
        return null
    }

    const metadata = rawMetadata as Record<string, any>

    return {
        ...metadata,
        isAnnouncement: Boolean(metadata.isAnnouncement),
        isImportant: Boolean(metadata.isImportant),
        isForwarded: Boolean(metadata.isForwarded),
    } as any
}

export const normalizeMessage = (msg: any): Message => ({
    ...msg,
    id: msg?.id || msg?._id || `temp-${Date.now()}-${Math.random()}`,
    content: normalizeMessageContent(msg?.content),
    metadata: normalizeMessageMetadata(msg?.metadata),
    attachments: Array.isArray(msg?.attachments) ? msg.attachments : undefined,
    reactions: Array.isArray(msg?.reactions) ? msg.reactions : [],
    readBy: Array.isArray(msg?.readBy) ? msg.readBy : [],
    isDeleted: Boolean(msg?.isDeleted),
    createdAt: msg?.createdAt || new Date().toISOString(),
    lastRead: msg?.lastRead,
})


export interface Participant {
    userId: string
    role: 'admin' | 'deputy' | 'member'
    joinedAt: string
    lastRead?: string
    lastSeen?: string | null
    // User info (populated)
    fullName?: string
    avatarUrl?: string
    status?: 'online' | 'offline' | 'away' | 'busy' | string
    nickname?: string
    isPinned?: boolean
    isMuted?: boolean
    muteUntil?: string | null
    isHidden?: boolean
    labelIds?: string[]
}

export type GroupPermissionScope = 'all' | 'admin_deputy' | 'admin'

export interface GroupJoinRequest {
    requestId: string
    userId: string
    requestedAt: string
    status: 'pending' | 'approved' | 'rejected'
    reviewedAt?: string
    reviewedBy?: string
}

export interface GroupPinnedMessage {
    messageId: string
    senderId: string
    type: Message['type']
    content: Message['content']
    metadata?: Message['metadata']
    pinnedAt: string
    pinnedBy: string
}

export interface GroupSettings {
    invite: {
        code: string
        approvalRequired: boolean
    }
    joinRequests: GroupJoinRequest[]
    permissions: {
        sendMessage: GroupPermissionScope
        sendMedia: GroupPermissionScope
        startCall: GroupPermissionScope
        pinMessage: GroupPermissionScope
        sendAnnouncement: GroupPermissionScope
    }
    pinnedMessage: GroupPinnedMessage | null
}

export interface Conversation {
    id: string
    type: 'private' | 'group'
    name?: string
    avatar?: string
    background?: string
    participants: Participant[]
    groupSettings?: GroupSettings
    lastMessage?: {
        content: any
        type: string
        senderId: string
        timestamp: string
        metadata?: Message['metadata']
    }
    unreadCount: number
    createdAt: string
    updatedAt: string
}

const getConversationTimestamp = (conv: Partial<Conversation> & Record<string, any>) => {
    const updatedAt = conv.updatedAt ? new Date(conv.updatedAt).getTime() : 0
    const lastMessageTs = conv.lastMessage?.timestamp
        ? new Date(conv.lastMessage.timestamp).getTime()
        : 0
    return Math.max(updatedAt, lastMessageTs)
}

const buildConversationKey = (conv: Partial<Conversation> & Record<string, any>) => {
    if (conv.type === 'private') {
        const participantKey = (conv.participants || [])
            .map((p: any) => String(p?.userId || ''))
            .filter(Boolean)
            .sort()
            .join('|')
        if (participantKey) return `private:${participantKey}`
    }

    const id = conv.id || conv._id
    if (id) return `id:${String(id)}`

    const groupParticipantKey = (conv.participants || [])
        .map((p: any) => String(p?.userId || ''))
        .filter(Boolean)
        .sort()
        .join('|')
    return `group:${conv.name || ''}:${groupParticipantKey}`
}

const normalizeConversation = (conv: Partial<Conversation> & Record<string, any>): Conversation => ({
    ...(conv as Conversation),
    id: String(conv.id || conv._id || ''),
    participants: Array.isArray(conv.participants) ? conv.participants : [],
    unreadCount: Number(conv.unreadCount || 0),
    createdAt: conv.createdAt || new Date().toISOString(),
    updatedAt: conv.updatedAt || conv.lastMessage?.timestamp || new Date().toISOString(),
})

const dedupeConversations = (conversations: Array<Partial<Conversation> & Record<string, any>>) => {
    const bestByKey = new Map<string, Conversation>()

    for (const conv of conversations) {
        if (!conv) continue
        const normalized = normalizeConversation(conv)
        const key = buildConversationKey(normalized)
        const existing = bestByKey.get(key)

        if (!existing) {
            bestByKey.set(key, normalized)
            continue
        }

        const currentTs = getConversationTimestamp(normalized)
        const existingTs = getConversationTimestamp(existing)
        const newer = currentTs >= existingTs ? normalized : existing
        const older = currentTs >= existingTs ? existing : normalized

        // Keep richer data when merging duplicates
        bestByKey.set(key, {
            ...older,
            ...newer,
            participants: newer.participants?.length ? newer.participants : older.participants,
            unreadCount: Math.max(Number(older.unreadCount || 0), Number(newer.unreadCount || 0)),
            lastMessage: newer.lastMessage || older.lastMessage,
            updatedAt: newer.updatedAt || older.updatedAt,
        })
    }

    return Array.from(bestByKey.values())
}

const resetConversationPresence = (conversations: Conversation[] = []) =>
    conversations.map((conversation) => ({
        ...conversation,
        participants: (conversation.participants || []).map((participant) => ({
            ...participant,
            status: 'offline',
        })),
    }))

interface ChatState {
    conversations: Conversation[]
    activeConversation: Conversation | null
    messages: Record<string, Message[]>  // conversationId -> messages
    typingUsers: Record<string, string[]>  // conversationId -> userIds
    isLoadingConversations: boolean
    isLoadingMessages: boolean
    labels: Label[]
    isLoadingLabels: boolean
    cacheOwnerUserId: string | null
    lastSyncedAt: number | null

    // Actions
    setLabels: (labels: Label[]) => void
    addLabel: (label: Label) => void
    updateLabel: (id: string, updates: Partial<Label>) => void
    removeLabel: (id: string) => void

    setConversations: (conversations: Conversation[]) => void
    addConversation: (conversation: Conversation) => void
    updateConversation: (id: string, updates: Partial<Conversation>) => void
    updateParticipantPresence: (userId: string, status: 'online' | 'offline', lastSeen?: string | null) => void
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
    initializeCacheForUser: (userId: string) => void
    clearChatState: () => void
    setLastSyncedAt: (value: number | null) => void

    // Helpers
    getConversationById: (id: string) => Conversation | undefined
    getMessagesForConversation: (id: string) => Message[]
}

const createInitialState = () => ({
    conversations: [] as Conversation[],
    activeConversation: null as Conversation | null,
    messages: {} as Record<string, Message[]>,
    typingUsers: {} as Record<string, string[]>,
    isLoadingConversations: false,
    isLoadingMessages: false,
    labels: [] as Label[],
    isLoadingLabels: false,
    cacheOwnerUserId: null as string | null,
    lastSyncedAt: null as number | null,
})

const normalizeAndDedupeMessages = (messages: Message[] = []) => {
    const deduped: Message[] = []
    const seen = new Set<string>()

    for (const raw of messages || []) {
        const normalized = normalizeMessage(raw)
        const id = String(normalized?.id || '')
        if (!id || seen.has(id)) continue
        seen.add(id)
        deduped.push(normalized)
    }

    return deduped
}

const trimCachedMessages = (messagesByConversation: Record<string, Message[]>) => {
    const next: Record<string, Message[]> = {}

    for (const [conversationId, messages] of Object.entries(messagesByConversation || {})) {
        if (!Array.isArray(messages) || messages.length === 0) continue
        next[conversationId] = messages.slice(-MAX_CACHED_MESSAGES_PER_CONVERSATION)
    }

    return next
}

export const useChatStore = create<ChatState>()(
    persist((set, get) => ({
    ...createInitialState(),

    setLabels: (labels) => set({ labels }),
    addLabel: (label) => set((state) => ({ labels: [...state.labels, label] })),
    updateLabel: (id, updates) => set((state) => ({
        labels: state.labels.map((l) => l._id === id ? { ...l, ...updates } : l)
    })),
    removeLabel: (id) => set((state) => ({
        labels: state.labels.filter(l => l._id !== id)
    })),

    setConversations: (conversations) => set({
        conversations: dedupeConversations(conversations)
    }),

    addConversation: (conversation) => set((state) => ({
        conversations: dedupeConversations([conversation, ...state.conversations])
    })),

    updateConversation: (id, updates) => set((state) => ({
        conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updates } : c
        ),
        activeConversation: state.activeConversation?.id === id
            ? { ...state.activeConversation, ...updates }
            : state.activeConversation
    })),

    updateParticipantPresence: (userId, status, lastSeen = null) => set((state) => {
        let changed = false
        const patchParticipants = (participants: Participant[] = []) => {
            let participantsChanged = false
            const nextParticipants = participants.map((participant) => {
                if (String(participant.userId) !== String(userId)) return participant

                const nextLastSeen = status === 'offline'
                    ? lastSeen || participant.lastSeen || null
                    : participant.lastSeen || null

                if (participant.status === status && (participant.lastSeen || null) === nextLastSeen) {
                    return participant
                }

                changed = true
                participantsChanged = true
                return {
                    ...participant,
                    status,
                    lastSeen: nextLastSeen,
                }
            })

            return participantsChanged ? nextParticipants : participants
        }

        const nextConversations = state.conversations.map((conversation) => {
            const nextParticipants = patchParticipants(conversation.participants)
            return nextParticipants === conversation.participants
                ? conversation
                : { ...conversation, participants: nextParticipants }
        })

        const nextActiveParticipants = state.activeConversation
            ? patchParticipants(state.activeConversation.participants)
            : null

        if (!changed) return state

        return {
            conversations: nextConversations,
            activeConversation: state.activeConversation
                ? {
                    ...state.activeConversation,
                    participants: nextActiveParticipants || state.activeConversation.participants,
                }
                : null,
        }
    }),

    removeConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversation: state.activeConversation?.id === id
            ? null
            : state.activeConversation
    })),

    setActiveConversation: (conversation) => set({ activeConversation: conversation }),

    setMessages: (conversationId, messages) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: normalizeAndDedupeMessages(messages)
        }
    })),

    addMessage: (conversationId, message) => set((state) => {
        const normalizedMessage = normalizeMessage(message)
        const current = state.messages[conversationId] || []
        if (current.some(m => m.id === normalizedMessage.id)) return state
        return {
            messages: {
                ...state.messages,
                [conversationId]: [...current, normalizedMessage]
            }
        }
    }),

    updateMessage: (conversationId, messageId, updates) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: normalizeAndDedupeMessages(
                (state.messages[conversationId] || []).map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                )
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
    setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),

    initializeCacheForUser: (userId) => {
        const normalizedUserId = String(userId || '')
        if (!normalizedUserId) return

        const owner = get().cacheOwnerUserId
        if (!owner) {
            set((state) => ({
                cacheOwnerUserId: normalizedUserId,
                conversations: resetConversationPresence(state.conversations),
                activeConversation: state.activeConversation
                    ? resetConversationPresence([state.activeConversation])[0]
                    : null,
            }))
            return
        }

        if (String(owner) !== normalizedUserId) {
            set({
                ...createInitialState(),
                cacheOwnerUserId: normalizedUserId,
            })
            return
        }

        set((state) => ({
            conversations: resetConversationPresence(state.conversations),
            activeConversation: state.activeConversation
                ? resetConversationPresence([state.activeConversation])[0]
                : null,
        }))
    },

    clearChatState: () => set({ ...createInitialState() }),

    getConversationById: (id) => get().conversations.find((c) => c.id === id),
    getMessagesForConversation: (id) => get().messages[id] || [],
}), {
    name: 'chat-storage',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        cacheOwnerUserId: state.cacheOwnerUserId,
        lastSyncedAt: state.lastSyncedAt,
        conversations: state.conversations.slice(0, MAX_CACHED_CONVERSATIONS),
        messages: trimCachedMessages(state.messages),
        labels: state.labels,
    }),
})
)

