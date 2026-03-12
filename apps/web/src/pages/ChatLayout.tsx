import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useChatStore } from '@/stores/chatStore'
// import { mockConversations, mockMessages } from '@/data/mockData'
import { getConversation, getMessages } from '@/services/api'
export default function ChatLayout() {
    const { setConversations, setMessages, conversations } = useChatStore()



    // Load mock data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const convs = await getConversation()
                setConversations(convs)
            } catch (error) {
                console.error('Error loading data:', error)
            }
        }
        loadData()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    console.log(conversations)

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-100">
            {/* Sidebar with conversations list */}
            <Sidebar />

            {/* Main content area */}
            <Outlet />
        </div>
    )
}
