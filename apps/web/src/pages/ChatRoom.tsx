import { useState, useRef, useEffect, useCallback, FormEvent, ChangeEvent, CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChatStore, type Message, type GroupPermissionScope, normalizeMessage } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/contexts/ToastContext'
import { useMediaUpload } from '@/hooks/useMediaUpload'
import { useDebounce } from '@/hooks/useDebounce'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useMessagePagination } from '@/hooks/useMessagePagination'
import {
    Send,
    Image,
    Paperclip,
    Smile as SmileIcon,
    Phone,
    Video,
    MoreVertical,
    Mic,
    Square,
    X,
    Reply,
    ArrowLeft,
    Sticker,
    Search,
    Loader,
    WifiOff,
    Megaphone,
    Pin,
    Star
} from 'lucide-react'
import MessageBubble from '@/components/chat/MessageBubble'
import TypingIndicator from '@/components/chat/TypingIndicator'
import StickerPicker from '@/components/chat/StickerPicker'
import VirtualizedMessageList from '@/components/chat/VirtualizedMessageList'
import { getMessages, getConversation, getGroupSettings, pinGroupMessage, unpinGroupMessage } from '@/services/api'
import { socketService } from '@/lib/socket'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import { deleteChatHistory, updateParticipantSetting, updateConversationBackground, uploadMedia, sendMessage as sendMessageApi } from '@/services/api'
import GroupManagementModal from '@/components/chat/GroupManagementModal'
import ForwardMessageModal from '@/components/chat/ForwardMessageModal'
import BackgroundPickerModal from '@/components/chat/BackgroundPickerModal'
import MuteConversationModal from '@/components/chat/MuteConversationModal'
import { useCallStore } from '@/stores/callStore'
import { formatMuteUntilLabel, getParticipantMuteState } from '@/lib/muteUtils'
import { getMessagePreviewText } from '@/lib/messagePreview'

const getConversationBackgroundStyle = (backgroundValue?: string): CSSProperties | undefined => {
    const value = backgroundValue?.trim()

    if (!value) return undefined

    if (/^(https?:\/\/|data:|blob:|\/)/i.test(value)) {
        return {
            backgroundImage: `url(${value})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }
    }

    return { background: value }
}

const isImageConversationBackground = (backgroundValue?: string) =>
    /^(https?:\/\/|data:|blob:|\/)/i.test(backgroundValue?.trim() || '')

const buildMessageMetadata = (isAnnouncement: boolean, isImportant: boolean) => {
    if (!isAnnouncement && !isImportant) return null

    return {
        ...(isAnnouncement ? { isAnnouncement: true } : {}),
        ...(isImportant ? { isImportant: true } : {}),
    }
}

export default function ChatRoom() {
    const { conversationId } = useParams<{ conversationId: string }>()
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { addToast } = useToast()
    const { validateFile, handleUploadError } = useMediaUpload()
    const { isOnline, status: offlineStatus, storeOfflineMessage } = useOfflineQueue()
    const {
        activeConversation,
        setMessages,
        typingUsers,
        addMessage,
        updateMessage,
        setActiveConversation,
        updateConversation,
    } = useChatStore()

    // âœ… DĂ¹ng selector Ä‘á»ƒ tá»± re-render khi cĂ³ tin má»›i
    const messages = useChatStore(
        state => state.messages[conversationId || ''] || []
    )

    const [message, setMessage] = useState('')
    
    const [replyTo, setReplyTo] = useState<string | null>(null)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showStickerPicker, setShowStickerPicker] = useState(false)
    const [isSendingMedia, setIsSendingMedia] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [searchMessageQuery, setSearchMessageQuery] = useState('')
    const debouncedSearchQuery = useDebounce(searchMessageQuery, 300)
    const [showGroupManagement, setShowGroupManagement] = useState(false)
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
    const [showBackgroundPicker, setShowBackgroundPicker] = useState(false)
    const [showMutePicker, setShowMutePicker] = useState(false)
    const [announcementMode, setAnnouncementMode] = useState(false)
    const [importantMode, setImportantMode] = useState(false)
    const [isPinningMessage, setIsPinningMessage] = useState(false)
    const [, setMinuteTick] = useState(() => Date.now())
    const [pendingMedia, setPendingMedia] = useState<{
        file: File
        type: 'image' | 'video' | 'file'
        previewUrl?: string
    } | null>(null)

    // Pagination state
    const pagination = useMessagePagination(conversationId)

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<BlobPart[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
    const emojiPickerRef = useRef<HTMLDivElement>(null)
    const stickerPickerRef = useRef<HTMLDivElement>(null)

    const typing = conversationId ? typingUsers[conversationId] || [] : []
    const conversationBackground = activeConversation?.background?.trim() || ''
    const conversationBackgroundStyle = getConversationBackgroundStyle(conversationBackground)
    const backgroundOverlayClassName = isImageConversationBackground(conversationBackground)
        ? 'absolute inset-0 bg-white/70 dark:bg-black/70'
        : 'absolute inset-0 bg-white/25 dark:bg-black/25'


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

    // Click outside emoji picker & menu & sticker picker â†’ Ä‘Ă³ng
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false)
            }
            if (stickerPickerRef.current && !stickerPickerRef.current.contains(e.target as Node)) {
                setShowStickerPicker(false)
            }
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false)
            }
        }
        if (showEmojiPicker || showStickerPicker || showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showEmojiPicker, showStickerPicker, showMenu])

    // Xá»­ lĂ½ chá»n emoji
    const onEmojiClick = useCallback((emojiData: EmojiClickData) => {
        setMessage(prev => prev + emojiData.emoji)
        setTimeout(() => {
            inputRef.current?.focus()
        }, 0)
    }, [])

    // Scroll to bottom khi cĂ³ tin nhắn má»›i
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Load messages tá»« API láº§n Ä‘áº§u
    useEffect(() => {
        if (!conversationId) return
        const msgs = useChatStore.getState().messages[conversationId] || []
        if (msgs.length === 0) {
            getMessages(conversationId)
                .then(data => setMessages(conversationId, data))
                .catch(err => console.error('Load messages error:', err))
        }
    }, [conversationId])

    // Set active conversation â€” subscribe to conversations so it re-runs
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

        // Náº¿u Ä‘Ă£ cĂ³ conversations trong store â†’ set active ngay
        if (trySetActive()) return

        // Náº¿u chÆ°a cĂ³ (vd: user truy cáº­p URL trá»±c tiáº¿p) â†’ tá»± load tá»« API
        if (conversations.length === 0) {
            getConversation()
                .then(convs => {
                    setConversations(convs)
                    // Sau khi load xong, tĂ¬m láº¡i conversation
                    const conv = convs.find((c: any) => c.id === conversationId)
                    if (conv) {
                        useChatStore.getState().setActiveConversation(conv)
                    }
                })
                .catch(err => console.error('Error loading conversations:', err))
        }
    }, [conversationId, conversations])

    useEffect(() => {
        setIsSearching(false)
        setSearchMessageQuery('')
        setAnnouncementMode(false)
        setImportantMode(false)
    }, [conversationId])

    useEffect(() => {
        return () => {
            if (pendingMedia?.previewUrl) {
                URL.revokeObjectURL(pendingMedia.previewUrl)
            }
        }
    }, [pendingMedia])

    useEffect(() => {
        const timer = window.setInterval(() => setMinuteTick(Date.now()), 60000)
        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        if (!isSearching) return

        searchInputRef.current?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return

            setIsSearching(false)
            setSearchMessageQuery('')
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isSearching])

    useEffect(() => {
        if (!conversationId || !activeConversation || activeConversation.type !== 'group') return

        getGroupSettings(conversationId)
            .then((settings) => {
                if (!settings) return;
                
                useChatStore.getState().updateConversation(conversationId, {
                    groupSettings: {
                        invite: {
                            code: settings.invite?.code || '',
                            approvalRequired: Boolean(settings.invite?.approvalRequired),
                        },
                        joinRequests: settings.pendingJoinRequests || [],
                        permissions: {
                            sendMedia: settings.permissions?.sendMedia || 'all',
                            pinMessage: settings.permissions?.pinMessage || 'admin_deputy',
                            sendAnnouncement: settings.permissions?.sendAnnouncement || 'admin_deputy',
                        },
                        pinnedMessage: settings.pinnedMessage || null,
                    }
                })
            })
            .catch((error) => {
                console.error('Load group settings error:', error)
            })
    }, [conversationId, activeConversation?.id, activeConversation?.type])

    // âœ… VĂ o phĂ²ng socket + láº¯ng nghe tin nhắn realtime
    useEffect(() => {
        if (!conversationId) return
        if (user?.id && !socketService.isConnected()) {
            socketService.connect(user.id)
        }

        updateConversation(conversationId, { unreadCount: 0 })
        socketService.joinRoom(conversationId)

        const handleTyping = ({ userId }: { userId: string }) => {
            if (userId !== user?.id) {
                useChatStore.getState().addTypingUser(conversationId, userId)
            }
        }

        const handleStopTyping = ({ userId }: { userId: string }) => {
            useChatStore.getState().removeTypingUser(conversationId, userId)
        }

        socketService.on('chat:typing', handleTyping)
        socketService.on('chat:stop_typing', handleStopTyping)

        return () => {
            socketService.leaveRoom(conversationId)
            socketService.off('chat:typing', handleTyping)
            socketService.off('chat:stop_typing', handleStopTyping)
        }
    }, [conversationId, user?.id, updateConversation])

    // Sau khi messages Ä‘Æ°á»£c load vĂ o phĂ²ng hiá»‡n táº¡i, auto read message má»›i nháº¥t chÆ°a Ä‘á»c
    useEffect(() => {
        if (!conversationId || !user?.id || messages.length === 0) return

        const latestUnreadFromOthers = [...messages]
            .reverse()
            .find(m => {
                const readBy = Array.isArray(m.readBy) ? m.readBy : []
                return m.senderId !== user.id && !readBy.some(r => r.userId === user.id)
            })

        if (latestUnreadFromOthers) {
            markMessageAsRead(latestUnreadFromOthers.id)
            updateConversation(conversationId, { unreadCount: 0 })
        }
    }, [messages, conversationId, user?.id, markMessageAsRead, updateConversation])

    // ✅ Gửi tin nhắn qua socket (hoặc lưu offline nếu không có kết nối)
    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault()
        if (!conversationId || !user) return
        if (!message.trim() && !pendingMedia) return
        if (activeConversation?.type === 'group' && announcementMode && !canSendAnnouncementInGroup) {
            addToast('Bạn không có quyền gửi thông báo trong nhóm này.', 'error', 4000)
            return
        }
        if (pendingMedia) {
            const caption = message.trim()
            await sendMediaMessage(pendingMedia.file, pendingMedia.type, undefined, caption || undefined)
            clearPendingMedia()
            setMessage('')
            setReplyTo(null)
            setAnnouncementMode(false)
            setImportantMode(false)
            return
        }


        // Dừng trạng thái typing ngay khi đã gửi tin nhắn
        clearTimeout(typingTimeoutRef.current)
        socketService.stopTyping(conversationId, user.id)

        const messageText = message.trim()
        const isAnnouncement = activeConversation?.type === 'group' && announcementMode
        const isImportant = importantMode
        const metadata = buildMessageMetadata(isAnnouncement, isImportant)
        setMessage('')
        setReplyTo(null)
        setAnnouncementMode(false)
        setImportantMode(false)

        // ✅ Optimistic update — hiện tin nhắn ngay lập tức
        const tempId = `temp-${Date.now()}`
        const optimisticMsg: Message = {
            id: tempId,
            conversationId,
            senderId: user.id,
            type: 'text',
            content: { text: messageText },
            metadata,
            replyTo: replyTo || undefined,
            reactions: [],
            readBy: [],
            isDeleted: false,
            createdAt: new Date().toISOString(),
        }
        addMessage(conversationId, optimisticMsg)

        // Check if online
        if (!isOnline) {
            // Store offline message for later sync
            try {
                await storeOfflineMessage(
                    conversationId,
                    user.id,
                    'text',
                    { text: messageText },
                    metadata || undefined,
                    replyTo || undefined
                )
                addToast('Bạn đang offline. Tin nhắn sẽ được gửi khi có kết nối.', 'info', 3000)
            } catch (error) {
                console.error('Failed to store offline message:', error)
                useChatStore.getState().removeMessage(conversationId, tempId)
                addToast('Lỗi khi lưu tin nhắn ngoại tuyến', 'error', 3000)
            }
            return
        }

        if (!socketService.isConnected()) {
            try {
                const saved = await sendMessageApi({
                    conversationId,
                    type: 'text',
                    content: { text: messageText },
                    metadata: metadata || undefined,
                    replyTo: replyTo || undefined,
                })
                useChatStore.getState().removeMessage(conversationId, tempId)
                addMessage(conversationId, normalizeMessage(saved))
            } catch (httpError) {
                useChatStore.getState().removeMessage(conversationId, tempId)
                console.error('Gửi tin nhắn thất bại (no-socket):', httpError)
                addToast('Không thể gửi tin nhắn. Vui lòng thử lại.', 'error', 3000)
            }
            return
        }

        // Gửi qua socket với ACK timeout + fallback HTTP để đảm bảo persistence
        const ack = await new Promise<{ success: boolean; message?: Message; error?: string }>((resolve) => {
            let done = false
            const timeout = setTimeout(() => {
                if (done) return
                done = true
                resolve({ success: false, error: 'ACK_TIMEOUT' })
            }, 2000)

            socketService.sendMessage({
                conversationId,
                senderId: user.id,
                type: 'text',
                content: { text: messageText },
                metadata: metadata || undefined,
                replyTo: replyTo || undefined,
            }, (res) => {
                if (done) return
                done = true
                clearTimeout(timeout)
                resolve(res)
            })
        })

        if (ack.success && ack.message) {
            useChatStore.getState().removeMessage(conversationId, tempId)
            addMessage(conversationId, normalizeMessage(ack.message))
        } else {
            try {
                const saved = await sendMessageApi({
                    conversationId,
                    type: 'text',
                    content: { text: messageText },
                    metadata: metadata || undefined,
                    replyTo: replyTo || undefined,
                })
                useChatStore.getState().removeMessage(conversationId, tempId)
                addMessage(conversationId, normalizeMessage(saved))
            } catch (httpError) {
                useChatStore.getState().removeMessage(conversationId, tempId)
                console.error('Gửi tin nhắn thất bại:', ack.error, httpError)
                addToast('Không thể gửi tin nhắn. Vui lòng thử lại.', 'error', 3000)
            }
        }

        // Cập nhật lastMessage trong sidebar ngay
        updateConversation(conversationId, {
            lastMessage: {
                type: 'text',
                senderId: user.id,
                timestamp: new Date().toISOString(),
                content: getMessagePreviewText({
                    type: 'text',
                    content: { text: messageText },
                    metadata,
                }),
            },
            updatedAt: new Date().toISOString(),
        })

        // Reset height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
        }
    }

    const handleForwardSend = (targetConversationIds: string[]) => {
        if (!forwardMessage || !user) return

        targetConversationIds.forEach(targetId => {
            const tempId = `temp-fw-${Date.now()}-${Math.random()}`
            const optimisticMsg: Message = {
                id: tempId,
                conversationId: targetId,
                senderId: user.id,
                type: forwardMessage.type,
                content: forwardMessage.content,
                metadata: { ...forwardMessage.metadata, isForwarded: true },
                reactions: [],
                readBy: [],
                isDeleted: false,
                createdAt: new Date().toISOString(),
            }
            addMessage(targetId, optimisticMsg)

            socketService.sendMessage({
                conversationId: targetId,
                senderId: user.id,
                type: forwardMessage.type,
                content: forwardMessage.content,
                metadata: { ...forwardMessage.metadata, isForwarded: true },
            }, (res) => {
                const store = useChatStore.getState()
                if (res.success) {
                    store.removeMessage(targetId, tempId)
                    store.addMessage(targetId, res.message)
                } else {
                    store.removeMessage(targetId, tempId)
                    console.error('Chuyển tiếp thất bại:', res.error)
                }
            })

            let previewText = '[Tin nhắn]'
            switch (forwardMessage.type) {
                case 'text': previewText = forwardMessage.content.text || ''; break;
                case 'image': previewText = '[Hình ảnh]'; break;
                case 'video': previewText = '[Video]'; break;
                case 'file': previewText = `[File] ${forwardMessage.content.fileName}`; break;
                case 'sticker': previewText = '[Nhãn dán]'; break;
                case 'voice': previewText = '[Tin nhắn thoại]'; break;
            }

            updateConversation(targetId, {
                lastMessage: {
                    content: previewText,
                    type: forwardMessage.type,
                    senderId: user.id,
                    timestamp: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
            })
        })

        setForwardMessage(null)
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
            if (timerRef.current) clearInterval(timerRef.current)
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
                mediaRecorderRef.current.stop()
            }
        }
    }, [conversationId, user?.id])

    // Auto-scale textarea height
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
            const newHeight = Math.min(inputRef.current.scrollHeight, 150)
            inputRef.current.style.height = `${newHeight}px`
        }
    }, [message])

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

    const clearPendingMedia = () => {
        if (pendingMedia?.previewUrl) {
            URL.revokeObjectURL(pendingMedia.previewUrl)
        }
        setPendingMedia(null)
    }

    const sendMediaMessage = async (
        file: File,
        type: 'image' | 'video' | 'file' | 'voice',
        duration?: number,
        caption?: string
    ) => {
        if (!conversationId || !user) return
        if (activeConversation?.type === 'group' && !canSendMediaInGroup) {
            addToast('Bạn không có quyền gửi media trong nhóm này.', 'error', 4000)
            return
        }

        const metadata = buildMessageMetadata(
            activeConversation?.type === 'group' && announcementMode,
            importantMode
        )

        // Validate file
        const validation = validateFile(file, type)
        if (!validation.valid) {
            return
        }

        try {
            setIsSendingMedia(true)
            addToast('Đang gửi...', 'info')

            // Check if offline
            if (!isOnline) {
                addToast('Bạn đang offline. Không thể gửi media lúc này.', 'warning', 3000)
                return
            }
            const canUseSocket = socketService.isConnected()

            // Upload media qua HTTP SDK (S3) thay vì Base64 socket cực tốn băng thông
            let mediaUrl = ''
            if (type !== 'voice') {
                const uploadRes = await uploadMedia(file)
                mediaUrl = uploadRes.url
            } else {
                // Voice message could be small enough for socket or you can format it for FormData too
                // Dùng uploadMedia cho voice luôn
                const voiceFile = new File([file], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
                const uploadRes = await uploadMedia(voiceFile)
                mediaUrl = uploadRes.url
            }

            const content: any = {
                mediaUrl: mediaUrl,
                fileName: file.name,
                fileSize: file.size,
            }
            if (caption) {
                content.text = caption
            }

            // Add duration for voice messages
            if (type === 'voice' && duration !== undefined) {
                content.duration = duration
            }

            const tempId = `temp-media-${Date.now()}`
            const optimisticMsg: Message = {
                id: tempId,
                conversationId,
                senderId: user.id,
                type,
                content,
                metadata,
                replyTo: replyTo || undefined,
                reactions: [],
                readBy: [],
                isDeleted: false,
                createdAt: new Date().toISOString(),
            }
            addMessage(conversationId, optimisticMsg)

            if (canUseSocket) {
                const ack = await new Promise<{ success: boolean; message?: Message; error?: string }>((resolve) => {
                    let done = false
                    const timeout = setTimeout(() => {
                        if (done) return
                        done = true
                        resolve({ success: false, error: 'ACK_TIMEOUT' })
                    }, 2000)

                    socketService.sendMessage({
                        conversationId,
                        senderId: user.id,
                        type,
                        content,
                        metadata: metadata || undefined,
                        replyTo: replyTo || undefined,
                    }, (res) => {
                        if (done) return
                        done = true
                        clearTimeout(timeout)
                        resolve(res)
                    })
                })

                if (ack.success && ack.message) {
                    useChatStore.getState().removeMessage(conversationId, tempId)
                    addMessage(conversationId, normalizeMessage(ack.message))
                    addToast('Gửi thành công!', 'success', 3000)
                } else {
                    // Socket ACK timeout/failure fallback: persist via HTTP API
                    try {
                        const saved = await sendMessageApi({
                            conversationId,
                            type,
                            content,
                            metadata: metadata || undefined,
                            replyTo: replyTo || undefined,
                        })

                        const normalizedSaved = normalizeMessage(saved)
                        useChatStore.getState().removeMessage(conversationId, tempId)
                        addMessage(conversationId, normalizedSaved)
                        addToast('Đã gửi thành công (qua kênh dự phòng).', 'success', 3000)
                    } catch (httpError) {
                        useChatStore.getState().removeMessage(conversationId, tempId)
                        const errMsg = ack.error === 'ACK_TIMEOUT'
                            ? 'Không nhận được xác nhận từ máy chủ. Vui lòng thử gửi lại.'
                            : (ack.error || 'Vui lòng thử lại.')
                        addToast(`Gửi thất bại: ${errMsg}`, 'error', 5000)
                        console.error('Media fallback HTTP failed:', httpError)
                        return
                    }
                }
            } else {
                // Socket ACK timeout/failure fallback: persist via HTTP API
                try {
                    const saved = await sendMessageApi({
                        conversationId,
                        type,
                        content,
                        metadata: metadata || undefined,
                        replyTo: replyTo || undefined,
                    })

                    const normalizedSaved = normalizeMessage(saved)
                    useChatStore.getState().removeMessage(conversationId, tempId)
                    addMessage(conversationId, normalizedSaved)
                    addToast('Đã gửi thành công.', 'success', 3000)
                } catch (httpError) {
                    useChatStore.getState().removeMessage(conversationId, tempId)
                    addToast('Gửi thất bại: Vui lòng thử lại.', 'error', 5000)
                    console.error('Media fallback HTTP failed:', httpError)
                    return
                }
            }

            updateConversation(conversationId, {
                lastMessage: {
                    type,
                    senderId: user.id,
                    timestamp: new Date().toISOString(),
                    content: getMessagePreviewText({
                        type,
                        content,
                        metadata,
                    }),
                },
                updatedAt: new Date().toISOString(),
            })
            setAnnouncementMode(false)
            setImportantMode(false)
        } catch (error) {
            handleUploadError(error, type)
        } finally {
            setIsSendingMedia(false)
        }
    }

    const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const type = file.type.startsWith('video/') ? 'video' : 'image'
        const validation = validateFile(file, type)
        if (!validation.valid) {
            e.target.value = ''
            return
        }

        if (pendingMedia?.previewUrl) {
            URL.revokeObjectURL(pendingMedia.previewUrl)
        }

        setPendingMedia({
            file,
            type,
            previewUrl: URL.createObjectURL(file),
        })
        e.target.value = ''
    }

    const handlePickFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const validation = validateFile(file, 'file')
        if (!validation.valid) {
            e.target.value = ''
            return
        }

        if (pendingMedia?.previewUrl) {
            URL.revokeObjectURL(pendingMedia.previewUrl)
        }

        setPendingMedia({
            file,
            type: 'file',
        })
        e.target.value = ''
    }

    const handleToggleRecord = async () => {
        if (activeConversation?.type === 'group' && !canSendMediaInGroup) {
            addToast('Bạn không có quyền gửi media trong nhóm này.', 'error', 4000)
            return
        }

        if (isRecording) {
            setIsRecording(false)
            if (timerRef.current) clearInterval(timerRef.current)
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop()
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                const mediaRecorder = new MediaRecorder(stream)
                mediaRecorderRef.current = mediaRecorder
                audioChunksRef.current = []

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data)
                }

                mediaRecorder.onstop = async () => {
                    stream.getTracks().forEach(track => track.stop())
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

                    if (audioChunksRef.current.length > 0) {
                        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
                        await sendMediaMessage(file, 'voice', recordingTime)
                    }
                    setRecordingTime(0)
                }

                mediaRecorder.start(200)
                setIsRecording(true)
                setRecordingTime(0)

                if (timerRef.current) clearInterval(timerRef.current)
                timerRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1)
                }, 1000)

            } catch (err) {
                console.error('Lỗi khi thu âm:', err)
                if (err instanceof Error && err.name === 'NotAllowedError') {
                    addToast('Quyền truy cập Microphone bị từ chối. Vui lòng cấp quyền trong cài đặt.', 'error', 5000)
                } else if (err instanceof Error && err.name === 'NotFoundError') {
                    addToast('Không tìm thấy Microphone. Vui lòng kiểm tra kết nối thiết bị.', 'error', 5000)
                } else {
                    addToast('Không thể truy cập Microphone. Vui lòng thử lại.', 'error', 5000)
                }
            }
        }
    }

    const handleSendSticker = (stickerUrl: string) => {
        if (!conversationId || !user) return
        if (activeConversation?.type === 'group' && !canSendMediaInGroup) {
            addToast('Bạn không có quyền gửi media trong nhóm này.', 'error', 4000)
            return
        }

        const metadata = buildMessageMetadata(false, importantMode)

        const stickerMsg: Message = {
            id: `temp-sticker-${Date.now()}`,
            conversationId,
            senderId: user.id,
            type: 'sticker',
            content: { mediaUrl: stickerUrl },
            metadata,
            reactions: [],
            readBy: [],
            isDeleted: false,
            createdAt: new Date().toISOString(),
        }
        addMessage(conversationId, stickerMsg); setShowStickerPicker(false)

        socketService.sendMessage({
            conversationId,
            senderId: user.id,
            type: 'sticker',
            content: { mediaUrl: stickerUrl },
            metadata: metadata || undefined,
        }, (res) => {
            if (res.success) {
                useChatStore.getState().removeMessage(conversationId, stickerMsg.id)
                addMessage(conversationId, normalizeMessage(res.message))
            } else {
                useChatStore.getState().removeMessage(conversationId, stickerMsg.id)
                console.error('Gửi sticker thất bại:', res.error)
            }
        })

        updateConversation(conversationId, {
            lastMessage: {
                type: 'sticker',
                senderId: user.id,
                timestamp: new Date().toISOString(),
                content: getMessagePreviewText({
                    type: 'sticker',
                    content: { mediaUrl: stickerUrl },
                    metadata,
                }),
            },
            updatedAt: new Date().toISOString(),
        })

        setImportantMode(false)
        setShowStickerPicker(false)
    }

    const handlePinMessage = async (messageId: string) => {
        if (!conversationId || !activeConversation || activeConversation.type !== 'group') return
        if (!canPinInGroup) {
            addToast('Bạn không có quyền ghim tin nhắn trong nhóm này.', 'error', 4000)
            return
        }

        try {
            setIsPinningMessage(true)
            const result = await pinGroupMessage(conversationId, messageId)
            const nextPinned = result.pinnedMessage || result.group?.groupSettings?.pinnedMessage || null

            useChatStore.getState().updateConversation(conversationId, {
                groupSettings: {
                    ...(activeConversation.groupSettings || {
                        invite: { code: '', approvalRequired: true },
                        joinRequests: [],
                        permissions: {
                            sendMedia: 'all',
                            pinMessage: 'admin_deputy',
                            sendAnnouncement: 'admin_deputy',
                        },
                    }),
                    pinnedMessage: nextPinned,
                }
            })
            addToast('Đã ghim tin nhắn', 'success', 2000)
        } catch (error: any) {
            addToast(error?.message || 'Không thể ghim tin nhắn', 'error', 4000)
        } finally {
            setIsPinningMessage(false)
        }
    }

    const handleUnpinMessage = async () => {
        if (!conversationId || !activeConversation || activeConversation.type !== 'group') return
        if (!canPinInGroup) {
            addToast('Bạn không có quyền bỏ ghim tin nhắn trong nhóm này.', 'error', 4000)
            return
        }

        try {
            setIsPinningMessage(true)
            await unpinGroupMessage(conversationId)
            useChatStore.getState().updateConversation(conversationId, {
                groupSettings: {
                    ...(activeConversation.groupSettings || {
                        invite: { code: '', approvalRequired: true },
                        joinRequests: [],
                        permissions: {
                            sendMedia: 'all',
                            pinMessage: 'admin_deputy',
                            sendAnnouncement: 'admin_deputy',
                        },
                    }),
                    pinnedMessage: null,
                }
            })
            addToast('Đã bỏ ghim tin nhắn', 'success', 2000)
        } catch (error: any) {
            addToast(error?.message || 'Không thể bỏ ghim tin nhắn', 'error', 4000)
        } finally {
            setIsPinningMessage(false)
        }
    }

    const getOtherParticipant = () => {
        if (!activeConversation || activeConversation.type === 'group') return null
        return activeConversation.participants.find(p => String(p.userId) !== String(user?.id))
    }

    const handleOpenUserProfile = (targetUserId?: string) => {
        if (!targetUserId) return
        navigate(`/profile/${targetUserId}`)
    }

    const handleDeleteHistory = async () => {
        if (!conversationId) return
        if (!confirm('Bạn có chắc muốn xóa toàn bộ tin nhắn trong cuộc trò chuyện này không? Hành động này không thể hoàn tác.')) return

        try {
            await deleteChatHistory(conversationId)
            // Cập nhật lại list messages trên client về []
            useChatStore.getState().setMessages(conversationId, [])
            setShowMenu(false)
            // Clear preview
            updateConversation(conversationId, {
                lastMessage: undefined,
                updatedAt: new Date().toISOString()
            })
        } catch (error) {
            console.error('Lỗi khi xóa lịch sử', error)
            alert('Không thể xóa lịch sử trò chuyện lúc này.')
        }
    }

    const otherUser = getOtherParticipant()
    const currentP = activeConversation?.participants.find(p => String(p.userId) === String(user?.id))
    const activeNickname = currentP?.nickname
    const muteState = getParticipantMuteState(currentP)
    const isMuted = muteState.isMuted
    const currentGroupRole = currentP?.role
    const inputFocusRingClass = announcementMode || importantMode
        ? 'focus:ring-amber-500'
        : 'focus:ring-primary-500'
    const normalizedSearchQuery = debouncedSearchQuery.trim().toLowerCase()
    const filteredMessages = messages.filter((msg) => {
        if (!normalizedSearchQuery) return true

        const text = msg.content.text?.toLowerCase() || ''
        const fileName = msg.content.fileName?.toLowerCase() || ''

        return text.includes(normalizedSearchQuery) || fileName.includes(normalizedSearchQuery)
    })

    const canUseGroupScope = useCallback((scope?: GroupPermissionScope) => {
        if (!scope) return true
        const roleRank: Record<'member' | 'deputy' | 'admin', number> = {
            member: 1,
            deputy: 2,
            admin: 3,
        }
        const scopeRank: Record<GroupPermissionScope, number> = {
            all: 1,
            admin_deputy: 2,
            admin: 3,
        }
        const rank = currentGroupRole ? roleRank[currentGroupRole] : 0
        return rank >= scopeRank[scope]
    }, [currentGroupRole])

    const groupPermissions = activeConversation?.groupSettings?.permissions
    const canSendMediaInGroup = activeConversation?.type !== 'group' || canUseGroupScope(groupPermissions?.sendMedia)
    const canSendAnnouncementInGroup = activeConversation?.type !== 'group' || canUseGroupScope(groupPermissions?.sendAnnouncement)
    const canPinInGroup = activeConversation?.type === 'group' && canUseGroupScope(groupPermissions?.pinMessage)
    const pinnedMessage = activeConversation?.groupSettings?.pinnedMessage || null

    const handleUpdateNickname = async () => {
        if (!conversationId || !user) return
        if (activeConversation?.type === 'group') {
            alert('Hiện chỉ hỗ trợ đổi tên gợi nhớ trong trò chuyện cá nhân.')
            return
        }

        const oldName = activeNickname || otherUser?.fullName || ''
        const newNickname = prompt('Nhập tên gợi nhớ (để trống để xóa):', oldName)
        if (newNickname === null) return

        try {
            await updateParticipantSetting(conversationId, user.id, { nickname: newNickname.trim() })
            useChatStore.getState().updateConversation(conversationId, {
                participants: activeConversation!.participants.map(part =>
                    String(part.userId) === String(user.id) ? { ...part, nickname: newNickname.trim() } : part
                )
            })
            setShowMenu(false)
        } catch (error) {
            console.error('Update nickname error', error)
            alert('Không thể đổi tên gợi nhớ lúc này.')
        }
    }

    const handleUpdateBackground = async (backgroundUrl: string) => {
        if (!conversationId) return

        try {
            await updateConversationBackground(conversationId, backgroundUrl)
            useChatStore.getState().updateConversation(conversationId, {
                background: backgroundUrl
            })
            addToast('Đổi hình nền thành công!', 'success', 3000)
        } catch (error) {
            console.error('Update background error', error)
            addToast('Không thể đổi hình nền lúc này.', 'error', 5000)
            throw error
        }
    }

    const handleUpdateMuteSettings = async (settings: { isMuted: boolean; muteUntil: string | null }) => {
        if (!conversationId || !user || !activeConversation) return

        try {
            await updateParticipantSetting(conversationId, user.id, settings)
            useChatStore.getState().updateConversation(conversationId, {
                participants: activeConversation.participants.map(part =>
                    String(part.userId) === String(user.id)
                        ? { ...part, isMuted: settings.isMuted, muteUntil: settings.isMuted ? settings.muteUntil : null }
                        : part
                )
            })
        } catch (error) {
            console.error('Update mute settings error', error)
            addToast('Không thể cập nhật thông báo lúc này.', 'error', 5000)
            throw error
        }
    }

    const conversationName = activeConversation?.type === 'group'
        ? activeConversation.name
        : (activeNickname || otherUser?.fullName || 'Người dùng')
    const conversationAvatar = activeConversation?.type === 'group'
        ? activeConversation.avatar
        : otherUser?.avatarUrl

    const handleStartVideoCall = () => {
        if (!conversationId || !user) return;
        if (activeConversation?.type === 'group') {
            alert('Tính năng gọi video nhóm đang được phát triển!');
            return;
        }
        if (!otherUser) return;
        useCallStore.getState().setOutgoingCall({
            isCaller: true,
            toUserId: otherUser.userId,
            conversationId: conversationId,
            callerName: user.fullName || 'Người dùng',
            callerAvatar: user.avatarUrl || undefined,
            callType: 'video'
        });
    };

    const handleStartVoiceCall = () => {
        if (!conversationId || !user) return;
        if (activeConversation?.type === 'group') {
            alert('Tính năng gọi thoại nhóm đang được phát triển!');
            return;
        }
        if (!otherUser) return;
        useCallStore.getState().setOutgoingCall({
            isCaller: true,
            toUserId: otherUser.userId,
            conversationId: conversationId,
            callerName: user.fullName || 'Người dùng',
            callerAvatar: user.avatarUrl || undefined,
            callType: 'audio'
        });
    };

    if (!conversationId || !activeConversation) {
        return (
            <div className="flex-1 min-w-0 flex items-center justify-center bg-gray-50 dark:bg-dark-100">
                <p className="text-gray-500">Chọn một cuộc trò chuyện</p>
            </div>
        )
    }

    return (
        <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-dark-200">
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <button
                        className="lg:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        onClick={() => setActiveConversation(null)}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (activeConversation?.type === 'private') {
                                handleOpenUserProfile(String(otherUser?.userId || ''))
                            }
                        }}
                        disabled={activeConversation?.type !== 'private' || !otherUser?.userId}
                        className={`relative ${activeConversation?.type === 'private' ? 'cursor-pointer' : 'cursor-default'}`}
                        title={activeConversation?.type === 'private' ? 'Xem trang cá nhân' : undefined}
                    >
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
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (activeConversation?.type === 'private') {
                                handleOpenUserProfile(String(otherUser?.userId || ''))
                            }
                        }}
                        disabled={activeConversation?.type !== 'private' || !otherUser?.userId}
                        className={`text-left ${activeConversation?.type === 'private' ? 'cursor-pointer' : 'cursor-default'}`}
                        title={activeConversation?.type === 'private' ? 'Xem trang cá nhân' : undefined}
                    >
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {conversationName}
                            {isMuted && <span className="text-gray-400" title={`Đã tắt thông báo ${formatMuteUntilLabel(muteState.muteUntil)}`}>🔇</span>}
                            {!isOnline && (
                                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-normal">
                                    <WifiOff className="w-3 h-3" />
                                    Offline
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            {!isOnline ? (
                                <>
                                    <span>Không có kết nối</span>
                                    {offlineStatus.pendingCount > 0 && (
                                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                            {offlineStatus.pendingCount} tin nhắn chờ
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    {otherUser?.status === 'online'
                                    ? 'Đang hoạt động'
                                        : activeConversation.type === 'group'
                                            ? `${activeConversation.participants.length} thành viên`
                                            : 'Offline'}
                                </>
                            )}
                        </p>
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            if (isSearching) {
                                setIsSearching(false)
                                setSearchMessageQuery('')
                                return
                            }

                            setIsSearching(true)
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                            isSearching
                                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                        title={isSearching ? 'Đóng tìm kiếm tin nhắn' : 'Tìm kiếm tin nhắn'}
                    >
                        <Search className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleStartVoiceCall}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                    >
                        <Phone className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleStartVideoCall}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                    >
                        <Video className="w-5 h-5" />
                    </button>
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-300 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-[100] animate-scale-in">
                                {activeConversation?.type === 'group' ? (
                                    <button
                                        onClick={() => {
                                            setShowGroupManagement(true)
                                            setShowMenu(false)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                                    >
                                        Quản trị nhóm
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleUpdateNickname}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                                    >
                                        Đổi tên gợi nhớ
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (isMuted) {
                                            handleUpdateMuteSettings({ isMuted: false, muteUntil: null })
                                                .then(() => setShowMenu(false))
                                                .catch(() => null)
                                            return
                                        }
                                        setShowMutePicker(true)
                                        setShowMenu(false)
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                                >
                                    {isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowBackgroundPicker(true)
                                        setShowMenu(false)
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-dark-100 transition-colors"
                                >
                                    Đổi hình nền
                                </button>
                                <button
                                    onClick={handleDeleteHistory}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-gray-100 dark:border-gray-800"
                                >
                                    Xóa lịch sử trò chuyện
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            {isSearching && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-300 animate-fade-in">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            ref={searchInputRef}
                            autoFocus
                            type="text"
                            value={searchMessageQuery}
                            onChange={(e) => setSearchMessageQuery(e.target.value)}
                            placeholder="Nhập từ khóa tìm kiếm..."
                            className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-dark-100 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
                        />
                        {searchMessageQuery && (
                            <button onClick={() => setSearchMessageQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                            {normalizedSearchQuery
                                ? `Tìm thấy ${filteredMessages.length} kết quả`
                                : 'Nhập từ khóa để tìm trong cuộc trò chuyện'}
                        </span>
                        <span>Esc để đóng</span>
                    </div>
                </div>
            )}

            {activeConversation?.type === 'group' && pinnedMessage && (
                <div className="px-4 py-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                        <Pin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Tin nhắn đã ghim</p>
                            <p className="text-sm text-amber-900 dark:text-amber-100 truncate">
                                {pinnedMessage.metadata?.isAnnouncement
                                    ? `[Thông báo] ${pinnedMessage.content?.text || ''}`.trim()
                                    : pinnedMessage.content?.text ||
                                    (pinnedMessage.type === 'image'
                                        ? '[Hình ảnh]'
                                        : pinnedMessage.type === 'video'
                                            ? '[Video]'
                                            : pinnedMessage.type === 'voice'
                                                ? '[Tin nhắn thoại]'
                                                : pinnedMessage.type === 'sticker'
                                                    ? '[Nhãn dán]'
                                                    : pinnedMessage.content?.fileName
                                                        ? `[File] ${pinnedMessage.content.fileName}`
                                                        : '[Tin nhắn]')}
                            </p>
                        </div>
                    </div>

                    {canPinInGroup && (
                        <button
                            onClick={handleUnpinMessage}
                            disabled={isPinningMessage}
                            className="text-xs px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-200 disabled:opacity-50"
                        >
                            Bỏ ghim
                        </button>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                {/* Custom Background */}
                {conversationBackgroundStyle && (
                    <div
                        className="absolute inset-0 z-0 pointer-events-none"
                        style={conversationBackgroundStyle}
                    >
                        <div className={backgroundOverlayClassName} />
                    </div>
                )}

                <VirtualizedMessageList
                    isLoading={pagination.isLoading}
                    hasMore={normalizedSearchQuery ? false : pagination.hasMore}
                    onReachTop={normalizedSearchQuery ? undefined : pagination.loadMore}
                    className="relative z-10"
                >
                    {(() => {
                        if (normalizedSearchQuery && filteredMessages.length === 0) {
                            return (
                                <div className="flex flex-col items-center justify-center py-10 opacity-60">
                                    <Search className="w-10 h-10 mb-3 text-gray-400" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                                        Không tìm thấy tin nhắn nào chứa <span className="font-medium">"{debouncedSearchQuery}"</span>
                                    </p>
                                </div>
                            )
                        }

                        return (
                            <>
                                {filteredMessages.map((msg, index) => {
                                    const isSent = msg.senderId === user?.id
                                    const showAvatar = !isSent && (
                                        index === 0 ||
                                        filteredMessages[index - 1].senderId !== msg.senderId
                                    )
                                    const sender = activeConversation?.participants.find(
                                        p => String(p.userId) === String(msg.senderId)
                                    )

                                    return (
                                        <MessageBubble
                                            key={msg.id}
                                            message={msg}
                                            isSent={isSent}
                                            showAvatar={showAvatar}
                                            senderUserId={sender ? String(sender.userId) : undefined}
                                            senderName={sender?.fullName}
                                            senderAvatar={sender?.avatarUrl ?? undefined}
                                            onAvatarClick={sender ? () => handleOpenUserProfile(String(sender.userId)) : undefined}
                                            replyMessage={msg.replyTo ? messages.find(m => m.id === msg.replyTo) || null : null}
                                            replySenderName={msg.replyTo ? (() => {
                                                const repliedMsg = messages.find(m => m.id === msg.replyTo)
                                                if (!repliedMsg) return undefined
                                                const repliedSender = activeConversation?.participants.find(p => String(p.userId) === String(repliedMsg.senderId))
                                                return repliedSender?.fullName
                                            })() : undefined}
                                            onReply={() => setReplyTo(msg.id)}
                                            onRecall={() => handleRecall(msg.id)}
                                            onReact={(emoji) => handleReact(msg.id, emoji)}
                                            onForward={() => setForwardMessage(msg)}
                                            onPin={() => handlePinMessage(msg.id)}
                                            canPin={Boolean(canPinInGroup && !msg.isDeleted)}
                                            participants={activeConversation?.participants?.map(p => ({
                                                userId: p.userId,
                                                fullName: p.fullName
                                            })) ?? []}
                                            isGroupChat={activeConversation?.type === 'group'}
                                            searchQuery={debouncedSearchQuery}
                                        />
                                    )
                                })}

                                {!normalizedSearchQuery && typing.length > 0 && <TypingIndicator />}
                                <div ref={messagesEndRef} />
                            </>
                        )
                    })()}
                </VirtualizedMessageList>
            </div>

            {/* Reply preview */}
            {replyTo && (() => {
                const repliedMsg = messages.find(m => m.id === replyTo)
                const repliedSender = repliedMsg
                    ? activeConversation?.participants.find(p => String(p.userId) === String(repliedMsg.senderId))
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
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 relative z-20">
                {pendingMedia && (
                    <div className="mb-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-300 p-2.5">
                        <div className="flex items-start gap-3">
                            {pendingMedia.type === 'image' && pendingMedia.previewUrl && (
                                <img
                                    src={pendingMedia.previewUrl}
                                    alt="Preview"
                                    className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                />
                            )}
                            {pendingMedia.type === 'video' && pendingMedia.previewUrl && (
                                <video
                                    src={pendingMedia.previewUrl}
                                    className="w-24 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                />
                            )}
                            {pendingMedia.type === 'file' && (
                                <div className="w-16 h-16 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-semibold text-xs px-1 text-center">
                                    {pendingMedia.file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {pendingMedia.file.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {(pendingMedia.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                                    Xem trước tệp. Nhấn gửi để gửi vào đoạn chat.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={clearPendingMedia}
                                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                                title="Hủy tệp"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={isSendingMedia || (activeConversation?.type === 'group' && !canSendMediaInGroup)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            title={isSendingMedia ? 'Đang gửi...' : activeConversation?.type === 'group' && !canSendMediaInGroup ? 'Bạn không có quyền gửi media' : 'Gửi hình ảnh/video'}
                        >
                            {isSendingMedia ? (
                                <Loader className="w-5 h-5 animate-spin-fast" />
                            ) : (
                                <Image className="w-5 h-5" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSendingMedia || (activeConversation?.type === 'group' && !canSendMediaInGroup)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            title={isSendingMedia ? 'Đang gửi...' : activeConversation?.type === 'group' && !canSendMediaInGroup ? 'Bạn không có quyền gửi media' : 'Gửi file'}
                        >
                            {isSendingMedia ? (
                                <Loader className="w-5 h-5 animate-spin-fast" />
                            ) : (
                                <Paperclip className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handlePickImage}
                        disabled={isSendingMedia || (activeConversation?.type === 'group' && !canSendMediaInGroup)}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handlePickFile}
                        disabled={isSendingMedia || (activeConversation?.type === 'group' && !canSendMediaInGroup)}
                    />

                    <div className="flex-1 relative" ref={emojiPickerRef}>
                        {isRecording ? (
                            <div className="w-full flex items-center justify-between px-4 py-2.5 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                    <span className="font-medium text-sm">Đang thu âm...</span>
                                </div>
                                <span className="font-mono">{Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</span>
                            </div>
                        ) : (
                            <>
                                <textarea
                                    ref={inputRef}
                                    value={message}
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            // Trigger form submission manually since it's a textarea now
                                            const form = e.currentTarget.closest('form')
                                            if (form) form.requestSubmit()
                                        }
                                    }}
                                    onChange={(e) => {
                                        setMessage(e.target.value)
                                        handleTyping()
                                    }}
                                    placeholder={announcementMode ? 'Nhập nội dung thông báo...' : 'Nhập tin nhắn...'}
                                    className={`w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-300 rounded-full
                                        text-gray-900 dark:text-white placeholder-gray-500
                                        focus:outline-none focus:ring-2 ${inputFocusRingClass}`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {activeConversation?.type === 'group' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!canSendAnnouncementInGroup) {
                                                    addToast('Bạn không có quyền gửi thông báo trong nhóm này.', 'error', 3500)
                                                    return
                                                }
                                                setAnnouncementMode((prev) => !prev)
                                            }}
                                            disabled={!canSendAnnouncementInGroup}
                                            className={`p-1 rounded-full transition-colors ${announcementMode ? 'bg-amber-100 text-amber-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                            title={canSendAnnouncementInGroup ? (announcementMode ? 'Tắt chế độ thông báo' : 'Bật chế độ thông báo') : 'Bạn không có quyền gửi thông báo'}
                                        >
                                            <Megaphone className="w-5 h-5" />
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setImportantMode((prev) => !prev)}
                                        className={`p-1 rounded-full transition-colors ${
                                            importantMode
                                                ? 'bg-amber-100 text-amber-600'
                                                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500'
                                        }`}
                                        title={importantMode ? 'Tắt chế độ tin nhắn quan trọng' : 'Bật chế độ tin nhắn quan trọng'}
                                    >
                                        <Star className={`w-5 h-5 ${importantMode ? 'fill-current' : ''}`} />
                                    </button>

                                    <div ref={stickerPickerRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowStickerPicker(!showStickerPicker)}
                                            disabled={activeConversation?.type === 'group' && !canSendMediaInGroup}
                                            className={`p-1 rounded-full transition-colors ${showStickerPicker ? 'bg-primary-100 text-primary-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500'
                                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                                            title={activeConversation?.type === 'group' && !canSendMediaInGroup ? 'Bạn không có quyền gửi media' : 'Nhãn dán'}
                                        >
                                            <Sticker className="w-5 h-5" />
                                        </button>

                                        {/* Sticker Picker Popup */}
                                        {showStickerPicker && (
                                            <div className="absolute bottom-full right-0 mb-2 z-[100]">
                                                <StickerPicker onSelect={handleSendSticker} />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className={`p-1 rounded-full transition-colors ${showEmojiPicker ? 'bg-primary-100 text-primary-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500'
                                            }`}
                                    >
                                        <SmileIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Emoji Picker Popup */}
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full right-0 mb-2 z-[100]">
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
                            </>
                        )}
                    </div>

                    {(message.trim() || pendingMedia) && !isRecording ? (
                        <button
                            type="submit"
                            className="p-3 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors flex-shrink-0"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleToggleRecord}
                            disabled={activeConversation?.type === 'group' && !canSendMediaInGroup}
                            className={`p-3 text-white rounded-full transition-all flex-shrink-0
                                ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-primary-500 hover:bg-primary-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                    )}
                </form>
            </div>

            <GroupManagementModal
                isOpen={showGroupManagement}
                onClose={() => setShowGroupManagement(false)}
                group={activeConversation}
            />

            <ForwardMessageModal
                isOpen={!!forwardMessage}
                onClose={() => setForwardMessage(null)}
                message={forwardMessage}
                onForward={handleForwardSend}
            />

            {showBackgroundPicker && (
                <BackgroundPickerModal
                    currentBackground={activeConversation?.background}
                    onApply={handleUpdateBackground}
                    onClose={() => setShowBackgroundPicker(false)}
                />
            )}

            {showMutePicker && activeConversation && (
                <MuteConversationModal
                    conversationName={conversationName || 'Cuộc trò chuyện'}
                    isMuted={muteState.isMuted}
                    muteUntil={muteState.muteUntil}
                    onApply={handleUpdateMuteSettings}
                    onClose={() => setShowMutePicker(false)}
                />
            )}
        </div>
    )
}
