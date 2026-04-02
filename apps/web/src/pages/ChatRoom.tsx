import { useState, useRef, useEffect, useCallback, FormEvent, ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore, type Message } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/contexts/ToastContext'
import { useMediaUpload } from '@/hooks/useMediaUpload'
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
    Loader
} from 'lucide-react'
import MessageBubble from '@/components/chat/MessageBubble'
import TypingIndicator from '@/components/chat/TypingIndicator'
import StickerPicker from '@/components/chat/StickerPicker'
import { getMessages, getConversation } from '@/services/api'
import { socketService } from '@/lib/socket'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import { deleteChatHistory, updateParticipantSetting, updateConversationBackground } from '@/services/api'
import GroupManagementModal from '@/components/chat/GroupManagementModal'
import ForwardMessageModal from '@/components/chat/ForwardMessageModal'
import BackgroundPickerModal from '@/components/chat/BackgroundPickerModal'

export default function ChatRoom() {
    const { conversationId } = useParams<{ conversationId: string }>()
    const { user } = useAuthStore()
    const { addToast } = useToast()
    const { validateFile, handleUploadError } = useMediaUpload()
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
    const [showStickerPicker, setShowStickerPicker] = useState(false)
    const [isSendingMedia, setIsSendingMedia] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [searchMessageQuery, setSearchMessageQuery] = useState('')
    const [showGroupManagement, setShowGroupManagement] = useState(false)
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
    const [showBackgroundPicker, setShowBackgroundPicker] = useState(false)

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<BlobPart[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
    const emojiPickerRef = useRef<HTMLDivElement>(null)
    const stickerPickerRef = useRef<HTMLDivElement>(null)

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

    // Click outside emoji picker & menu & sticker picker → đóng
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
        const handleReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
            useChatStore.getState().updateMessage(conversationId, messageId, {
                reactions
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

    const sendMediaMessage = async (file: File, type: 'image' | 'video' | 'file' | 'voice', duration?: number) => {
        if (!conversationId || !user) return

        // Validate file
        const validation = validateFile(file, type)
        if (!validation.valid) {
            return
        }

        try {
            setIsSendingMedia(true)
            addToast('Đang gửi...', 'info')

            const dataUrl = await readFileAsDataUrl(file)

            const content: any = {
                mediaUrl: dataUrl,
                fileName: file.name,
                fileSize: file.size,
            }

            // Add duration for voice messages
            if (type === 'voice' && duration !== undefined) {
                content.duration = duration
            }

            socketService.sendMessage({
                conversationId,
                senderId: user.id,
                type,
                content,
            }, (res) => {
                if (res.success) {
                    addToast('Gửi thành công!', 'success', 3000)
                } else {
                    addToast(`Gửi thất bại: ${res.error || 'Vui lòng thử lại.'}`, 'error', 5000)
                    console.error('Gửi media thất bại:', res.error)
                }
            })

            updateConversation(conversationId, {
                lastMessage: {
                    content: type === 'image' ? '[Hình ảnh]' : type === 'video' ? '[Video]' : type === 'voice' ? '[Tin nhắn thoại]' : `[File] ${file.name}`,
                    type,
                    senderId: user.id,
                    timestamp: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
            })
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
        await sendMediaMessage(file, type)
        e.target.value = ''
    }

    const handlePickFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await sendMediaMessage(file, 'file')
        e.target.value = ''
    }

    const handleToggleRecord = async () => {
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

        const stickerMsg: Message = {
            id: `temp-sticker-${Date.now()}`,
            conversationId,
            senderId: user.id,
            type: 'sticker',
            content: { mediaUrl: stickerUrl },
            reactions: [],
            readBy: [],
            isDeleted: false,
            createdAt: new Date().toISOString(),
        }
        addMessage(conversationId, stickerMsg)

        socketService.sendMessage({
            conversationId,
            senderId: user.id,
            type: 'sticker',
            content: { mediaUrl: stickerUrl },
        }, (res) => {
            if (res.success) {
                useChatStore.getState().removeMessage(conversationId, stickerMsg.id)
                addMessage(conversationId, res.message)
            } else {
                useChatStore.getState().removeMessage(conversationId, stickerMsg.id)
                console.error('Gửi sticker thất bại:', res.error)
            }
        })

        updateConversation(conversationId, {
            lastMessage: {
                content: '[Nhãn dán]',
                type: 'sticker',
                senderId: user.id,
                timestamp: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
        })

        setShowStickerPicker(false)
    }

    const getOtherParticipant = () => {
        if (!activeConversation || activeConversation.type === 'group') return null
        return activeConversation.participants.find(p => p.userId !== user?.id)
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
    const currentP = activeConversation?.participants.find(p => p.userId === user?.id)
    const activeNickname = currentP?.nickname
    const isMuted = currentP?.isMuted

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
                    part.userId === user.id ? { ...part, nickname: newNickname.trim() } : part
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

    const conversationName = activeConversation?.type === 'group'
        ? activeConversation.name
        : (activeNickname || otherUser?.fullName || 'Người dùng')
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
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            {conversationName}
                            {isMuted && <span className="text-gray-400" title="Đã tắt thông báo">🔕</span>}
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
                    <button
                        onClick={() => setIsSearching(!isSearching)}
                        className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 transition-colors ${isSearching ? 'bg-gray-100 dark:bg-gray-800 text-primary-500' : ''}`}
                        title="Tìm kiếm tin nhắn"
                    >
                        <Search className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                        <Phone className="w-5 h-5" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
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
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-300 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-50 animate-scale-in">
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
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                {/* Custom Background */}
                {activeConversation?.background && (
                    <div
                        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
                        style={{ backgroundImage: `url(${activeConversation.background})` }}
                    >
                        <div className="absolute inset-0 bg-white/70 dark:bg-black/70" />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        (() => {
                            const filteredMessages = messages.filter(msg => {
                                if (!searchMessageQuery) return true
                                if (msg.type === 'text' && msg.content.text) {
                                    return msg.content.text.toLowerCase().includes(searchMessageQuery.toLowerCase())
                                }
                                return false
                            })

                            if (searchMessageQuery && filteredMessages.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-60">
                                        <Search className="w-10 h-10 mb-3 text-gray-400" />
                                        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                                            Không tìm thấy tin nhắn nào chứa "<span className="font-medium">{searchMessageQuery}</span>"
                                        </p>
                                    </div>
                                )
                            }

                            return filteredMessages.map((msg, index) => {
                                const isSent = msg.senderId === user?.id
                                const showAvatar = !isSent && (
                                    index === 0 ||
                                    filteredMessages[index - 1].senderId !== msg.senderId
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
                                        onForward={() => setForwardMessage(msg)}
                                    />
                                )
                            })
                        })()
                    )}

                    {typing.length > 0 && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>
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
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            title={isSendingMedia ? 'Đang gửi...' : 'Gửi hình ảnh/video'}
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
                            disabled={isSendingMedia}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                            title={isSendingMedia ? 'Đang gửi...' : 'Gửi file'}
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
                        disabled={isSendingMedia}
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handlePickFile}
                        disabled={isSendingMedia}
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
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <div ref={stickerPickerRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowStickerPicker(!showStickerPicker)}
                                            className={`p-1 rounded-full transition-colors ${showStickerPicker ? 'bg-primary-100 text-primary-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500'
                                                }`}
                                        >
                                            <Sticker className="w-5 h-5" />
                                        </button>

                                        {/* Sticker Picker Popup */}
                                        {showStickerPicker && (
                                            <div className="absolute bottom-full right-0 mb-2 z-50">
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
                            </>
                        )}
                    </div>

                    {message.trim() && !isRecording ? (
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
                            className={`p-3 text-white rounded-full transition-all flex-shrink-0
                                ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-primary-500 hover:bg-primary-600'}`}
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
        </div>
    )
}