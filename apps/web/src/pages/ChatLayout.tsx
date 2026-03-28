import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getConversation } from '@/services/api'
import { socketService } from '@/lib/socket'

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
        }

        // Disconnect khi rời trang
        return () => {
            socketService.disconnect()
        }
    }, [user?.id])

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-100">
            <Sidebar />
            <Outlet />
        </div>
    )
}