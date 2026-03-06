import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import { useChatStore } from '@/stores/chatStore'
import { mockConversations, mockMessages } from '@/data/mockData'

export default function ChatLayout() {
    const { setConversations, setMessages, conversations } = useChatStore()

    // Load mock data on mount
    useEffect(() => {
        if (conversations.length === 0) {
            setConversations(mockConversations)
            // Pre-load all mock messages into the store
            Object.entries(mockMessages).forEach(([convId, msgs]) => {
                setMessages(convId, msgs)
            })
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-100">
            {/* Sidebar with conversations list */}
            <Sidebar />

            {/* Main content area */}
            <Outlet />
        </div>
    )
}
