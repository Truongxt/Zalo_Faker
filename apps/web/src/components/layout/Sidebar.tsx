import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore, Conversation } from '@/stores/chatStore'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
    Search,
    Plus,
    Users,
    MessageCircle,
    User as UserIcon,
    Bot
} from 'lucide-react'

export default function Sidebar() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { conversations, activeConversation, setActiveConversation } = useChatStore()

    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'groups'>('all')

    const filteredConversations = conversations.filter(conv => {
        // Search filter
        if (searchQuery) {
            const name = conv.type === 'group'
                ? conv.name
                : conv.participants.find(p => p.userId !== user?.id)?.fullName
            if (!name?.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false
            }
        }

        // Tab filter
        if (activeTab === 'unread' && conv.unreadCount === 0) return false
        if (activeTab === 'groups' && conv.type !== 'group') return false

        return true
    })

    const getConversationName = (conv: Conversation) => {
        if (conv.type === 'group') return conv.name || 'Nhóm chat'
        const other = conv.participants.find(p => p.userId !== user?.id)
        return other?.fullName || 'Người dùng'
    }

    const getConversationAvatar = (conv: Conversation) => {
        if (conv.type === 'group') return conv.avatar
        const other = conv.participants.find(p => p.userId !== user?.id)
        return other?.avatarUrl
    }

    const getOnlineStatus = (conv: Conversation) => {
        if (conv.type === 'group') return false
        const other = conv.participants.find(p => p.userId !== user?.id)
        return other?.status === 'online'
    }

    const handleConversationClick = (conv: Conversation) => {
        setActiveConversation(conv)
        navigate(`/chat/${conv.id}`)
    }

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tin nhắn</h1>
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm"
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-dark-300 rounded-lg
                       text-gray-900 dark:text-white placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-3">
                    {[
                        { id: 'all', label: 'Tất cả' },
                        { id: 'unread', label: 'Chưa đọc' },
                        { id: 'groups', label: 'Nhóm' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${activeTab === tab.id
                                    ? 'bg-primary-500 text-white'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Assistant shortcut */}
            <button
                className="mx-4 mt-4 flex items-center gap-3 p-3 bg-gradient-to-r from-primary-500/10 to-purple-500/10 
                   border border-primary-200 dark:border-primary-800 rounded-xl hover:from-primary-500/20 hover:to-purple-500/20 transition-all"
            >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">AI Trợ lý</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Hỏi bất cứ điều gì</p>
                </div>
            </button>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto p-2">
                {filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                        <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-sm">Chưa có cuộc trò chuyện</p>
                    </div>
                ) : (
                    filteredConversations.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => handleConversationClick(conv)}
                            className={`chat-item w-full ${activeConversation?.id === conv.id ? 'active' : ''
                                }`}
                        >
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                                {getConversationAvatar(conv) ? (
                                    <img
                                        src={getConversationAvatar(conv)!}
                                        alt={getConversationName(conv)}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                        {conv.type === 'group' ? (
                                            <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                        ) : (
                                            <span className="text-lg font-medium text-primary-600 dark:text-primary-400">
                                                {getConversationName(conv).charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {getOnlineStatus(conv) && (
                                    <span className="online-indicator" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                        {getConversationName(conv)}
                                    </h3>
                                    {conv.lastMessage && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                                            {formatDistanceToNow(new Date(conv.lastMessage.timestamp), {
                                                addSuffix: false,
                                                locale: vi
                                            })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        {conv.lastMessage?.content || 'Bắt đầu cuộc trò chuyện'}
                                    </p>
                                    {conv.unreadCount > 0 && (
                                        <span className="badge flex-shrink-0 ml-2">
                                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Bottom navigation */}
            <div className="border-t border-gray-200 dark:border-gray-800 p-2">
                <div className="flex items-center justify-around">
                    <button className="flex flex-col items-center gap-1 p-2 text-primary-500">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-xs">Tin nhắn</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 p-2 text-gray-500 dark:text-gray-400 hover:text-primary-500">
                        <Users className="w-5 h-5" />
                        <span className="text-xs">Danh bạ</span>
                    </button>
                    <Link
                        to="/profile"
                        className="flex flex-col items-center gap-1 p-2 text-gray-500 dark:text-gray-400 hover:text-primary-500"
                    >
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                            <UserIcon className="w-5 h-5" />
                        )}
                        <span className="text-xs">Cá nhân</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
