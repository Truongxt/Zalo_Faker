import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useChatStore, normalizeMessage } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getConversation } from '@/services/api'
import { socketService } from '@/lib/socket'
import IncomingCallModal from '@/components/chat/IncomingCallModal'
import VideoCallModal from '@/components/chat/VideoCallModal'
import { useCallStore } from '@/stores/callStore'

export default function ChatLayout() {
    const { setConversations, addMessage, updateMessage, updateConversation } = useChatStore()
    const { user } = useAuthStore()

    useEffect(() => {
        // Load danh sách conversations
        const loadData = async () => {
            try {
                const convs = await getConversation()
                setConversations(convs)
                
                // Sau khi load xong conversations, join toàn bộ các room để nhận tin nhắn real-time cho sidebar
                if (convs && convs.length > 0) {
                    const roomIds = convs.map((c: any) => c.id)
                    socketService.joinRooms(roomIds)
                }
            } catch (error) {
                console.error('Error loading conversations:', error)
            }
        }
        loadData()

        // Kết nối socket khi vào chat
        if (user?.id) {
            socketService.connect(user.id)

            const handleIncomingCall = (data: any) => {
                const { setIncomingCall } = useCallStore.getState();
                setIncomingCall(data);
            };

            // Lắng nghe tin nhắn mới REAL-TIME TOÀN CỤC
            const handleNewMessageGlobal = (msg: any) => {
                console.log('📬 Socket: Received new message:', msg)
                const normalizedMsg = normalizeMessage(msg)
                const conversationId = normalizedMsg.conversationId
                const store = useChatStore.getState()
                const activeConversationId = store.activeConversation?.id

                // Tránh trùng lặp tin nhắn nếu client nhận cả từ ack và broadcast
                const existing = store.messages[conversationId] || []
                const isDuplicate = existing.some(m => m.id === normalizedMsg.id)
                
                if (!isDuplicate) {
                    addMessage(conversationId, normalizedMsg)
                    console.log('✅ Added message to store:', normalizedMsg.id)
                } else {
                    console.log('ℹ️ Message with ID', normalizedMsg.id, 'already exists (duplicate), ignoring.')
                    return // Stop further processing if duplicate
                }


                // Tính toán số tin nhắn chưa đọc
                const currentConv = store.conversations.find(c => c.id === conversationId)
                let newUnreadCount = 0
                
                if (activeConversationId !== conversationId) {
                    newUnreadCount = (currentConv?.unreadCount || 0) + 1
                }

                // Cập nhật thông tin tin nhắn cuối cùng ở Sidebar
                updateConversation(conversationId, {
                    lastMessage: {
                        content: normalizedMsg.content.text || (
                            normalizedMsg.type === 'image' ? '[Hình ảnh]' :
                            normalizedMsg.type === 'video' ? '[Video]' :
                            normalizedMsg.type === 'voice' ? '[Tin nhắn thoại]' : 
                            normalizedMsg.type === 'file' ? `[File] ${normalizedMsg.content.fileName || ''}` : '[Media]'
                        ),
                        type: normalizedMsg.type,
                        senderId: normalizedMsg.senderId,
                        timestamp: normalizedMsg.createdAt,
                    },
                    updatedAt: normalizedMsg.createdAt,
                    unreadCount: newUnreadCount
                })
            }

            // Lắng nghe thu hồi tin nhắn toàn cục
            const handleRecalledGlobal = (data: { messageId: string; conversationId: string }) => {
                console.log('🗑️ Socket: Message recalled:', data)
                updateMessage(data.conversationId, data.messageId, { isDeleted: true })
            }

            // Lắng nghe reaction toàn cục
            const handleReactionGlobal = (data: { messageId: string; conversationId: string; reactions: any[] }) => {
                console.log('👍 Socket: Reaction update:', data)
                updateMessage(data.conversationId, data.messageId, { reactions: data.reactions })
            }

            const socket = socketService.getSocket()
            if (socket) {
                console.log('🔌 Attaching global listeners to socket:', socket.id)
                socket.on('video:incoming-call', handleIncomingCall)
                socket.on('chat:message', handleNewMessageGlobal)
                socket.on('chat:recalled', handleRecalledGlobal)
                socket.on('chat:reaction', handleReactionGlobal)
            }

        }

        // Disconnect khi rời trang
        return () => {
            const socket = socketService.getSocket()
            if (socket) {
                socket.off('video:incoming-call')
                socket.off('chat:message')
                socket.off('chat:recalled')
                socket.off('chat:reaction')
            }
            socketService.disconnect()
        }
    }, [user?.id, setConversations, addMessage, updateMessage, updateConversation])

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-100 relative overflow-hidden">
            <Sidebar />
            <Outlet />
            <IncomingCallModal />
            <VideoCallModal />
        </div>
    )
}
