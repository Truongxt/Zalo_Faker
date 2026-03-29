import { useState, useRef, useEffect, useCallback, FormEvent, ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore, type Message } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
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
import { getMessages, getConversation } from '@/services/api'
import { socketService } from '@/lib/socket'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'

export default function ChatRoom() {
    const { conversationId } = useParams<{ conversationId: string }>()
    const { user } = useAuthStore()
    const {
        activeConversation,
        setMessages,
        typingUsers,
        addMessage,
        updateMessage,
        setActiveConversation,
        updateConversation,
    } = useChatStore()

    // ✅ Dùng selector để tự re-render khi có tin mới
    const messages = useChatStore(
        state => state.messages[conversationId || ''] || []
    )

    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [replyTo, setReplyTo] = useState<string | null>(null)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [isSendingMedia, setIsSendingMedia] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
    const emojiPickerRef = useRef<HTMLDivElement>(null)

    const readFileAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                if (typeof reader.result === 'string') resolve(reader.result)
                else reject(new Error('Không thể đọc file'))
            }
            reader.onerror = () => reject(reader.error || new Error('Đọc file thất bại'))
            reader.readAsDataURL(file)
        })

    const typing = conversationId ? typingUsers[conversationId] || [] : []

    const markMessageAsRead = useCallback((messageId: string) => {
        if (!conversationId || !user?.id) return

        socketService.markAsRead(conversationId, messageId, user.id)

        const msg = (useChatStore.getState().messages[conversationId] || []).find(m => m.id === messageId)
        if (!msg) return

        const alreadyRead = msg.readBy.some(r => r.userId === user.id)
        if (!alreadyRead) {
            updateMessage(conversationId, messageId, {
                readBy: [...msg.readBy, { userId: user.id, readAt: new Date().toISOString() }],
            })
        }
    }, [conversationId, user?.id, updateMessage])

    // Click outside emoji picker → đóng
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false)
            }
        }
        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showEmojiPicker])

    // Xử lý chọn emoji
    const onEmojiClick = useCallback((emojiData: EmojiClickData) => {
        setMessage(prev => prev + emojiData.emoji)
        inputRef.current?.focus()
    }, [])

    // Scroll to bottom khi có tin nhắn mới
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Load messages từ API lần đầu
    useEffect(() => {
        if (!conversationId) return
        const msgs = useChatStore.getState().messages[conversationId] || []
        if (msgs.length === 0) {
            setIsLoading(true)
            getMessages(conversationId)
                .then(data => setMessages(conversationId, data))
                .catch(err => console.error('Load messages error:', err))
                .finally(() => setIsLoading(false))
        }
    }, [conversationId])

    // Set active conversation — subscribe to conversations so it re-runs
    // when the conversation list finishes loading from the API
    const conversations = useChatStore(state => state.conversations)
    const { setConversations } = useChatStore()

    useEffect(() => {
        if (!conversationId) return

        const trySetActive = () => {
            const conv = useChatStore.getState().getConversationById(conversationId)
            if (conv) {
                useChatStore.getState().setActiveConversation(conv)
                return true
            }
            return false
        }

        // Nếu đã có conversations trong store → set active ngay
        if (trySetActive()) return

        // Nếu chưa có (vd: user truy cập URL trực tiếp) → tự load từ API
        if (conversations.length === 0) {
            getConversation()
                .then(convs => {
                    setConversations(convs)
                    // Sau khi load xong, tìm lại conversation
                    const conv = convs.find((c: any) => c.id === conversationId)
                    if (conv) {
                        useChatStore.getState().setActiveConversation(conv)
                    }
                })
                .catch(err => console.error('Error loading conversations:', err))
        }
    }, [conversationId, conversations])

    // ✅ Vào phòng socket + lắng nghe tin nhắn realtime
    useEffect(() => {
        if (!conversationId) return

        updateConversation(conversationId, { unreadCount: 0 })
        socketService.joinRoom(conversationId)

        const handleNewMessage = (msg: Message) => {
            // ✅ Bỏ qua tin nhắn của chính mình — đã có optimistic update
            if (msg.senderId === user?.id) return

            const existing = useChatStore.getState().messages[conversationId] || []
            const isDuplicate = existing.some(m => m.id === msg.id)
            if (!isDuplicate) {
                addMessage(conversationId, msg)
            }

            // Đang mở đúng phòng thì đánh dấu đã đọc ngay
            markMessageAsRead(msg.id)

            updateConversation(conversationId, {
                lastMessage: {
                    content: msg.content.text || '[Media]',
                    type: msg.type,
                    senderId: msg.senderId,
                    timestamp: msg.createdAt,
                },
                unreadCount: 0,
                updatedAt: msg.createdAt,
            })
        }

        const handleTyping = ({ userId }: { userId: string }) => {
            if (userId !== user?.id) {
                useChatStore.getState().addTypingUser(conversationId, userId)
            }
        }

        const handleStopTyping = ({ userId }: { userId: string }) => {
            useChatStore.getState().removeTypingUser(conversationId, userId)
        }

        // Lắng nghe thu hồi tin nhắn
        const handleRecalled = ({ messageId }: { messageId: string }) => {
            const currentMessages = useChatStore.getState().messages[conversationId] || []
            const msg = currentMessages.find(m => m.id === messageId)
            if (msg?.isDeleted) return

            useChatStore.getState().updateMessage(conversationId, messageId, {
                isDeleted: true,
            })
        }

        // Lắng nghe reaction tin nhắn (idempotent — trùng event không toggle nhầm)
        const handleReaction = ({ messageId, userId, emoji }: { messageId: string; userId: string; emoji: string }) => {
            const currentMessages = useChatStore.getState().messages[conversationId] || []
            const msg = currentMessages.find(m => m.id === messageId)
            if (!msg) return

            const existing = msg.reactions.find(r => r.userId === userId)
            if (existing?.emoji === emoji) return

            const newReactions = [
                ...msg.reactions.filter(r => r.userId !== userId),
                { userId, emoji }
            ]
            useChatStore.getState().updateMessage(conversationId, messageId, {
                reactions: newReactions
            })
        }

        socketService.on('chat:message', handleNewMessage)
        socketService.on('chat:typing', handleTyping)
        socketService.on('chat:stop_typing', handleStopTyping)
        socketService.on('chat:recalled', handleRecalled)
        socketService.on('chat:reaction', handleReaction)

        return () => {
            socketService.leaveRoom(conversationId)
            socketService.off('chat:message', handleNewMessage)
            socketService.off('chat:typing', handleTyping)
            socketService.off('chat:stop_typing', handleStopTyping)
            socketService.off('chat:recalled', handleRecalled)
            socketService.off('chat:reaction', handleReaction)
        }
    }, [conversationId, user?.id, markMessageAsRead, addMessage, updateConversation])

    // Sau khi messages được load vào phòng hiện tại, auto read message mới nhất chưa đọc
    useEffect(() => {
        if (!conversationId || !user?.id || messages.length === 0) return

        const latestUnreadFromOthers = [...messages]
            .reverse()
            .find(m => m.senderId !== user.id && !m.readBy.some(r => r.userId === user.id))

        if (latestUnreadFromOthers) {
            markMessageAsRead(latestUnreadFromOthers.id)
            updateConversation(conversationId, { unreadCount: 0 })
        }
    }, [messages, conversationId, user?.id, markMessageAsRead, updateConversation])

    // ✅ Gửi tin nhắn qua socket
    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault()
        if (!message.trim() || !conversationId || !user) return

        // Dừng trạng thái typing ngay khi đã gửi tin nhắn
        clearTimeout(typingTimeoutRef.current)
        socketService.stopTyping(conversationId, user.id)

        const messageText = message.trim()
        setMessage('')
        setReplyTo(null)

        // ✅ Optimistic update — hiện tin nhắn ngay lập tức
        const tempId = `temp-${Date.now()}`
        const optimisticMsg: Message = {
            id: tempId,
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
        addMessage(conversationId, optimisticMsg)

        // Gửi qua socket
        socketService.sendMessage({
            conversationId,
            senderId: user.id,
            type: 'text',
            content: { text: messageText },
            replyTo: replyTo || undefined,
        }, (res) => {
            if (res.success) {
                // ✅ Thay tin nhắn tạm bằng tin nhắn thật từ server
                useChatStore.getState().removeMessage(conversationId, tempId)
                addMessage(conversationId, res.message)
            } else {
                // ❌ Gửi thất bại — xóa tin nhắn tạm
                useChatStore.getState().removeMessage(conversationId, tempId)
                console.error('Gửi tin nhắn thất bại:', res.error)
            }
        })

        // Cập nhật lastMessage trong sidebar ngay
        updateConversation(conversationId, {
            lastMessage: {
                content: messageText,
                type: 'text',
                senderId: user.id,
                timestamp: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
        })
    }

    // ✅ Typing indicator với debounce
    const handleTyping = () => {
        if (!conversationId || !user) return

        socketService.sendTyping(conversationId, user.id)

        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
            socketService.stopTyping(conversationId, user.id)
        }, 2000)
    }

    // Cleanup typing timer + emit stop typing khi đổi phòng/unmount
    useEffect(() => {
        return () => {
            clearTimeout(typingTimeoutRef.current)
            if (conversationId && user?.id) {
                socketService.stopTyping(conversationId, user.id)
            }
        }
    }, [conversationId, user?.id])

    const handleRecall = (messageId: string) => {
        if (!conversationId || !user) return
        socketService.recallMessage({
            messageId,
            conversationId,
            senderId: user.id,
        }, (res) => {
            if (res.success) {
                // Optimistic update — đánh dấu tin nhắn đã xóa ngay
                useChatStore.getState().updateMessage(conversationId, messageId, {
                    isDeleted: true,
                })
            } else {
                console.error('Thu hồi thất bại:', res.error)
            }
        })
    }

    // ✅ Reaction handler
    const handleReact = (messageId: string, emoji: string) => {
        if (!conversationId || !user) return
        // Optimistic update — thêm reaction ngay
        const currentMessages = useChatStore.getState().messages[conversationId] || []
        const msg = currentMessages.find(m => m.id === messageId)
        if (msg) {
            const existingReaction = msg.reactions.find(r => r.userId === user.id)
            let newReactions
            if (existingReaction && existingReaction.emoji === emoji) {
                // Toggle off — bỏ reaction
                newReactions = msg.reactions.filter(r => r.userId !== user.id)
            } else {
                // Thêm/thay đổi reaction
                newReactions = [
                    ...msg.reactions.filter(r => r.userId !== user.id),
                    { userId: user.id, emoji }
                ]
            }
            useChatStore.getState().updateMessage(conversationId, messageId, {
                reactions: newReactions
            })
        }

        // Gửi qua socket
        socketService.reactToMessage({
            messageId,
            conversationId,
            userId: user.id,
            emoji
        })
    }

    const sendMediaMessage = async (file: File, type: 'image' | 'file') => {
        if (!conversationId || !user) return

        // Prevent payload too large for socket/db
        const maxSizeBytes = 5 * 1024 * 1024
        if (file.size > maxSizeBytes) {
            alert('File quá lớn. Vui lòng chọn file <= 5MB.')
            return
        }

        try {
            setIsSendingMedia(true)
            const dataUrl = await readFileAsDataUrl(file)

            socketService.sendMessage({
                conversationId,
                senderId: user.id,
                type,
                content: {
                    mediaUrl: dataUrl,
                    fileName: file.name,
                    fileSize: file.size,
                },
            }, (res) => {
                if (!res.success) {
                    console.error('Gửi media thất bại:', res.error)
                }
            })

            updateConversation(conversationId, {
                lastMessage: {
                    content: type === 'image' ? '[Hình ảnh]' : `[File] ${file.name}`,
                    type,
                    senderId: user.id,
                    timestamp: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
            })
        } catch (error) {
            console.error('Không thể xử lý file:', error)
            alert('Không thể gửi file này. Vui lòng thử lại.')
        } finally {
            setIsSendingMedia(false)
        }
    }

    const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await sendMediaMessage(file, 'image')
        e.target.value = ''
    }

    const handlePickFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await sendMediaMessage(file, 'file')
        e.target.value = ''
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
                    <button
                        className="lg:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        onClick={() => setActiveConversation(null)}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

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

                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            {conversationName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {otherUser?.status === 'online'
                                ? 'Đang hoạt động'
                                : activeConversation.type === 'group'
                                    ? `${activeConversation.participants.length} thành viên`
                                    : 'Offline'}
                        </p>
                    </div>
                </div>

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
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isSent = msg.senderId === user?.id
                        const showAvatar = !isSent && (
                            index === 0 ||
                            messages[index - 1].senderId !== msg.senderId
                        )
                        const sender = activeConversation?.participants.find(
                            p => p.userId === msg.senderId
                        )

                        return (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                isSent={isSent}
                                showAvatar={showAvatar}
                                senderName={sender?.fullName}
                                senderAvatar={sender?.avatarUrl ?? undefined}
                                replyMessage={msg.replyTo ? messages.find(m => m.id === msg.replyTo) || null : null}
                                replySenderName={msg.replyTo ? (() => {
                                    const repliedMsg = messages.find(m => m.id === msg.replyTo)
                                    if (!repliedMsg) return undefined
                                    const repliedSender = activeConversation?.participants.find(p => p.userId === repliedMsg.senderId)
                                    return repliedSender?.fullName
                                })() : undefined}
                                onReply={() => setReplyTo(msg.id)}
                                onRecall={() => handleRecall(msg.id)}
                                onReact={(emoji) => handleReact(msg.id, emoji)}
                            />
                        )
                    })
                )}

                {typing.length > 0 && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (() => {
                const repliedMsg = messages.find(m => m.id === replyTo)
                const repliedSender = repliedMsg
                    ? activeConversation?.participants.find(p => p.userId === repliedMsg.senderId)
                    : null
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
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={isSendingMedia}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                        >
                            <Image className="w-5 h-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSendingMedia}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                    </div>
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePickImage}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handlePickFile}
                    />

                    <div className="flex-1 relative" ref={emojiPickerRef}>
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
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors
                                ${showEmojiPicker
                                    ? 'bg-primary-100 text-primary-500'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500'
                                }`}
                        >
                            <SmileIcon className="w-5 h-5" />
                        </button>

                        {/* Emoji Picker Popup */}
                        {showEmojiPicker && (
                            <div className="absolute bottom-full right-0 mb-2 z-50">
                                <EmojiPicker
                                    onEmojiClick={onEmojiClick}
                                    theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                                    width={350}
                                    height={400}
                                    searchPlaceHolder="Tìm emoji..."
                                    previewConfig={{ showPreview: false }}
                                    lazyLoadEmojis={true}
                                />
                            </div>
                        )}
                    </div>

                    {message.trim() ? (
                        <button
                            type="submit"
                            className="p-3 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors"
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