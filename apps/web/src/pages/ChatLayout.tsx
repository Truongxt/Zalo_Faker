import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getConversation } from '@/services/api'
import { socketService } from '@/lib/socket'
import IncomingCallModal from '@/components/chat/IncomingCallModal'
import VideoCallModal from '@/components/chat/VideoCallModal'
import { useCallStore } from '@/stores/callStore'

export default function ChatLayout() {
    const { setConversations } = useChatStore()
    const { user } = useAuthStore()

    useEffect(() => {
        // Load danh sách conversations
        const loadData = async () => {
            try {
                const convs = await getConversation()
                setConversations(convs)
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
            // Lắng nghe có người gọi tới mới tinh
            socketService.getSocket()?.on('video:incoming-call', handleIncomingCall);
        }

        // Disconnect khi rời trang
        return () => {
             if (user?.id) {
                socketService.getSocket()?.off('video:incoming-call');
            }
            socketService.disconnect()
        }
    }, [user?.id])

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-100 relative overflow-hidden">
            <Sidebar />
            <Outlet />
            <IncomingCallModal />
            <VideoCallModal />
        </div>
    )
}