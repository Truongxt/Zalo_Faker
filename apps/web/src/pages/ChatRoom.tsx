import { useState, useRef, useEffect, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore, type Message } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
// getUserById đã được thay bằng tra cứu participants
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
    Send,
    Image,
    Paperclip,
    Smile as SmileIcon,
    Phone,
    Video,
    MoreVertical,
    Mic,
    X,
    Reply,
    ArrowLeft
} from 'lucide-react'
import MessageBubble from '@/components/chat/MessageBubble'
import TypingIndicator from '@/components/chat/TypingIndicator'
import { getMessages } from '@/services/api'


export default function ChatRoom() {
    const { conversationId } = useParams<{ conversationId: string }>()
    const { user } = useAuthStore()
    const {
        activeConversation,
        getMessagesForConversation,
        setMessages,
        typingUsers,
        addMessage,
        setActiveConversation
    } = useChatStore()

    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [replyTo, setReplyTo] = useState<string | null>(null)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const messages = conversationId ? getMessagesForConversation(conversationId) : []
    const typing = conversationId ? typingUsers[conversationId] || [] : []

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (!conversationId) return
        const msgs = getMessagesForConversation(conversationId)
        if (msgs.length === 0) {
            getMessages(conversationId).then(data => {
                setMessages(conversationId, data)
            })
        }
    }, [conversationId])
    // Set active conversation when navigating
    useEffect(() => {
        if (conversationId) {
            const conv = useChatStore.getState().getConversationById(conversationId)
            if (conv) {
                useChatStore.getState().setActiveConversation(conv)
            }
        }
    }, [conversationId])

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault()
        if (!message.trim() || !conversationId || !user) return

        const messageText = message.trim()
        setMessage('')
        setReplyTo(null)
        setIsLoading(true)

        // Mock: create message locally (replace with chatService.sendMessage when backend is ready)
        const newMsg: Message = {
            id: `msg-${Date.now()}`,
            conversationId,
            senderId: user.id,
            type: 'text',
            content: { text: messageText },
            replyTo: replyTo || undefined,
            reactions: [],
            readBy: [],
            isDeleted: false,
            createdAt: new Date().toISOString(),
        }
        addMessage(conversationId, newMsg)

        // Update conversation's lastMessage
        useChatStore.getState().updateConversation(conversationId, {
            lastMessage: {
                content: messageText,
                type: 'text',
                senderId: user.id,
                timestamp: newMsg.createdAt,
            },
            updatedAt: newMsg.createdAt,
        })

        setIsLoading(false)
    }

    const handleTyping = () => {
        // Mock: no-op (replace with chatService.sendTyping when backend is ready)
    }

    const getOtherParticipant = () => {
        if (!activeConversation || activeConversation.type === 'group') return null
        return activeConversation.participants.find(p => p.userId !== user?.id)
    }

    const otherUser = getOtherParticipant()
    const conversationName = activeConversation?.type === 'group'
        ? activeConversation.name
        : otherUser?.fullName || 'Người dùng'
    const conversationAvatar = activeConversation?.type === 'group'
        ? activeConversation.avatar
        : otherUser?.avatarUrl

    if (!conversationId || !activeConversation) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-dark-100">
                <p className="text-gray-500">Chọn một cuộc trò chuyện</p>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-dark-200">
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    {/* Back button for mobile */}
                    <button
                        className="lg:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        onClick={() => setActiveConversation(null)}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    {/* Avatar */}
                    <div className="relative">
                        {conversationAvatar ? (
                            <img
                                src={conversationAvatar}
                                alt={conversationName}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <span className="text-primary-600 dark:text-primary-400 font-medium">
                                    {conversationName?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        {otherUser?.status === 'online' && (
                            <span className="online-indicator" />
                        )}
                    </div>

                    {/* Info */}
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            {conversationName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {otherUser?.status === 'online' ? 'Đang hoạt động' :
                                activeConversation.type === 'group'
                                    ? `${activeConversation.participants.length} thành viên`
                                    : 'Offline'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                        <Phone className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                        <Video className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => {
                    const isSent = msg.senderId === user?.id
                    const showAvatar = !isSent && (
                        index === 0 ||
                        messages[index - 1].senderId !== msg.senderId
                    )

                    // Lookup sender info for avatar
                    const sender = activeConversation?.participants.find(p => p.userId === msg.senderId)

                    return (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isSent={isSent}
                            showAvatar={showAvatar}
                            senderName={sender?.fullName}
                            senderAvatar={sender?.avatarUrl ?? undefined}
                            onReply={() => setReplyTo(msg.id)}
                        />
                    )
                })}

                {/* Typing indicator */}
                {typing.length > 0 && <TypingIndicator />}

                <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (() => {
                const repliedMsg = messages.find(m => m.id === replyTo)
                const repliedSender = repliedMsg ? activeConversation?.participants.find(p => p.userId === repliedMsg.senderId) : null
                return (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-dark-300 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <Reply className="w-4 h-4 text-primary-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-primary-500">
                                    {repliedSender?.fullName || 'Người dùng'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                    {repliedMsg?.content.text || 'Tin nhắn'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setReplyTo(null)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                )
            })()}

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    {/* Attachments */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                        >
                            <Image className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Input field */}
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={message}
                            onChange={(e) => {
                                setMessage(e.target.value)
                                handleTyping()
                            }}
                            placeholder="Nhập tin nhắn..."
                            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-300 rounded-full
                         text-gray-900 dark:text-white placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500"
                        >
                            <SmileIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Send button */}
                    {message.trim() ? (
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="p-3 bg-primary-500 text-white rounded-full hover:bg-primary-600 
                         transition-colors disabled:opacity-50"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="p-3 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors"
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                    )}
                </form>
            </div>
        </div>
    )
}
