import { socketService } from '@/lib/socket'
import { useChatStore, Message, Conversation } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { notificationService } from './notificationService'
import { baseAPI } from './api'

export const chatService = {
    // Initialize socket listeners
    init() {
        const { user } = useAuthStore.getState()
        if (!user?.id) return

        const socket = socketService.connect(user.id)
        if (!socket) return

        socketService.on('chat:message', (message: Message) => {
            const { addMessage, updateConversation } = useChatStore.getState()
            addMessage(message.conversationId, message)

            // Update last message in conversation
            updateConversation(message.conversationId, {
                lastMessage: {
                    content: message.content,
                    type: message.type,
                    senderId: message.senderId,
                    timestamp: message.createdAt,
                    metadata: message.metadata || null,
                }
            })

            // Show browser notification
            const { activeConversation } = useChatStore.getState()
            const currentUserId = useAuthStore.getState().user?.id

            if (
                String(message.senderId) !== String(currentUserId) &&
                (!activeConversation || String(activeConversation.id) !== String(message.conversationId))
            ) {
                const content = typeof message.content === 'string' ? message.content : (message.content as any)?.text || '[Tin nhắn mới]'
                notificationService.showNotification(
                    message.senderName || 'Tin nhắn mới',
                    content,
                    message.senderAvatar || undefined
                )
            }
        })

        socketService.on('video:incoming-call', (data: any) => {
            const currentUserId = useAuthStore.getState().user?.id
            if (String(data.callerId) === String(currentUserId)) return

            notificationService.showNotification(
                'Cuộc gọi đến',
                `${data.callerName || 'Ai đó'} đang gọi cho bạn`,
                data.callerAvatar || undefined
            )
        })

        socketService.on('chat:typing', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
            const { addTypingUser, removeTypingUser } = useChatStore.getState()
            addTypingUser(conversationId, userId)

            // Remove typing indicator after 3 seconds
            setTimeout(() => {
                removeTypingUser(conversationId, userId)
            }, 3000)
        })

        socketService.on('chat:read', ({ conversationId, messageId, userId }: { conversationId: string; messageId: string; userId: string }) => {
            const { updateMessage } = useChatStore.getState()
            updateMessage(conversationId, messageId, {
                readBy: [{ userId, readAt: new Date().toISOString() }]
            })
        })

        socketService.on('chat:recalled', ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
            const { updateMessage } = useChatStore.getState()
            updateMessage(conversationId, messageId, { isDeleted: true })
        })
    },

    // Load conversations
    async loadConversations() {
        const { accessToken } = useAuthStore.getState()
        const { setConversations, setLoadingConversations } = useChatStore.getState()

        setLoadingConversations(true)

        try {
            const response = await fetch(`${baseAPI}/conversations`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            if (!response.ok) throw new Error('Failed to load conversations')

            const conversations: Conversation[] = await response.json()
            setConversations(conversations)
        } catch (error) {
            console.error('Failed to load conversations:', error)
        } finally {
            setLoadingConversations(false)
        }
    },

    // Load messages for a conversation
    async loadMessages(conversationId: string, before?: string) {
        const { accessToken } = useAuthStore.getState()
        const { setMessages, setLoadingMessages } = useChatStore.getState()

        setLoadingMessages(true)

        try {
            const url = new URL(`${baseAPI}/conversations/${conversationId}/messages`)
            if (before) url.searchParams.set('before', before)
            url.searchParams.set('limit', '50')

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            if (!response.ok) throw new Error('Failed to load messages')

            const messages: Message[] = await response.json()
            setMessages(conversationId, messages)
        } catch (error) {
            console.error('Failed to load messages:', error)
        } finally {
            setLoadingMessages(false)
        }
    },

    // Send a message
    async sendMessage(conversationId: string, data: {
        type: Message['type']
        content: Message['content']
        replyTo?: string
    }) {
        const { accessToken, user } = useAuthStore.getState()
        const { addMessage } = useChatStore.getState()

        if (!user?.id) return

        // Optimistically add message
        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            conversationId,
            senderId: user.id,
            type: data.type,
            content: data.content,
            replyTo: data.replyTo,
            reactions: [],
            readBy: [],
            isDeleted: false,
            createdAt: new Date().toISOString()
        }
        addMessage(conversationId, tempMessage)

        // Send via socket for real-time
        socketService.sendMessage({
            conversationId,
            senderId: user.id,
            type: data.type,
            content: data.content,
            replyTo: data.replyTo
        })

        // Also send via HTTP for persistence
        try {
            const response = await fetch(`${baseAPI}/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(data)
            })

            if (!response.ok) throw new Error('Failed to send message')
        } catch (error) {
            console.error('Failed to send message:', error)
            // Could implement retry logic or remove optimistic message
        }
    },

    // Send typing indicator
    sendTyping(conversationId: string) {
        const { user } = useAuthStore.getState()
        if (!user?.id) return
        socketService.sendTyping(conversationId, user.id)
    },

    // Mark messages as read
    async markAsRead(conversationId: string, messageId: string) {
        const { accessToken, user } = useAuthStore.getState()
        if (!user?.id) return

        socketService.markAsRead(conversationId, messageId, user.id)

        try {
            await fetch(`${baseAPI}/conversations/${conversationId}/messages/${messageId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })
        } catch (error) {
            console.error('Failed to mark as read:', error)
        }
    },

    // Delete a message
    async deleteMessage(conversationId: string, messageId: string) {
        const { accessToken, user } = useAuthStore.getState()
        if (!user?.id) return
        const { updateMessage } = useChatStore.getState()

        // Optimistic update
        updateMessage(conversationId, messageId, { isDeleted: true })

        try {
            await fetch(`${baseAPI}/conversations/${conversationId}/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            socketService.recallMessage({
                messageId,
                conversationId,
                senderId: user.id
            })
        } catch (error) {
            console.error('Failed to delete message:', error)
            // Revert optimistic update
            updateMessage(conversationId, messageId, { isDeleted: false })
        }
    },

    // Add reaction to message
    async addReaction(conversationId: string, messageId: string, emoji: string) {
        const { user } = useAuthStore.getState()
        if (!user?.id) return

        socketService.reactToMessage({
            conversationId,
            messageId,
            userId: user.id,
            emoji
        })
    },

    // Create a new conversation
    async createConversation(participantIds: string[], type: 'private' | 'group' = 'private', name?: string): Promise<Conversation> {
        const { accessToken } = useAuthStore.getState()

        const response = await fetch(`${baseAPI}/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ participantIds, type, name })
        })

        if (!response.ok) throw new Error('Failed to create conversation')

        const rawConversation: any = await response.json()
        const conversation: Conversation = {
            ...rawConversation,
            id: rawConversation.id || rawConversation._id,
        }

        const { addConversation } = useChatStore.getState()
        addConversation(conversation)

        return conversation
    }
}

export default chatService
