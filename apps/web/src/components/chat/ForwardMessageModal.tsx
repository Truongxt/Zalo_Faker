import { useState, useMemo, useEffect } from 'react'
import { X, Search, Users, Share } from 'lucide-react'
import { useChatStore, Message, Conversation } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'

interface ForwardMessageModalProps {
    isOpen: boolean
    onClose: () => void
    message: Message | null
    onForward: (conversationIds: string[]) => void
}

export default function ForwardMessageModal({ isOpen, onClose, message, onForward }: ForwardMessageModalProps) {
    const { conversations } = useChatStore()
    const { user } = useAuthStore()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('')
            setSelectedIds(new Set())
        }
    }, [isOpen])

    const getConversationName = (conv: Conversation) => {
        const currentP = conv.participants.find(p => p.userId === user?.id)
        if (currentP?.nickname) return currentP.nickname

        if (conv.type === 'group') return conv.name || 'Nhóm chat'
        const other = conv.participants.find(p => p.userId !== user?.id)
        return other?.fullName || 'Người dùng'
    }

    const getConversationAvatar = (conv: Conversation) => {
        if (conv.type === 'group') return conv.avatar
        const other = conv.participants.find(p => p.userId !== user?.id)
        return other?.avatarUrl
    }

    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations
        return conversations.filter(conv => {
            const name = getConversationName(conv)
            return name.toLowerCase().includes(searchQuery.toLowerCase())
        })
    }, [conversations, searchQuery, user])

    if (!isOpen || !message) return null

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    const handleForward = () => {
        if (selectedIds.size === 0) return
        onForward(Array.from(selectedIds))
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-xl w-full max-w-md flex flex-col md:max-h-[85vh] max-h-[90vh] animate-scale-in overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Share className="w-5 h-5 text-primary-500" />
                        Chuyển tiếp
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-100 rounded-full text-gray-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-dark-300">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nội dung tin nhắn:</p>
                    <div className="bg-white dark:bg-dark-100 p-3 rounded-xl border border-gray-200 dark:border-gray-700 max-h-24 overflow-y-auto w-full break-words">
                        {message.type === 'text' && <p className="text-sm text-gray-800 dark:text-gray-200">{message.content.text}</p>}
                        {message.type === 'image' && <div className="flex flex-col gap-1 text-sm"><span className="text-primary-500 font-medium">[Hình ảnh]</span>{message.content.text}</div>}
                        {message.type === 'video' && <div className="flex flex-col gap-1 text-sm"><span className="text-primary-500 font-medium">[Video]</span>{message.content.text}</div>}
                        {message.type === 'file' && <p className="text-sm text-primary-500 font-medium">[Tài liệu] {message.content.fileName}</p>}
                        {message.type === 'sticker' && <p className="text-sm text-primary-500 font-medium">[Nhãn dán]</p>}
                        {message.type === 'voice' && <p className="text-sm text-primary-500 font-medium">[Tin nhắn thoại]</p>}
                    </div>
                </div>

                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm trò chuyện..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-dark-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 min-h-[50vh] md:min-h-0">
                    {filteredConversations.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Không tìm thấy trò chuyện nào
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredConversations.map(conv => {
                                const isSelected = selectedIds.has(conv.id)
                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() => toggleSelect(conv.id)}
                                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-100 cursor-pointer transition-colors"
                                    >
                                        <div className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center transition-colors">
                                            {isSelected && (
                                                <div className="w-full h-full bg-primary-500 flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="relative">
                                            {getConversationAvatar(conv) ? (
                                                <img
                                                    src={getConversationAvatar(conv)!}
                                                    alt={getConversationName(conv)}
                                                    className="w-10 h-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                    {conv.type === 'group' ? (
                                                        <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                                    ) : (
                                                        <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                                            {getConversationName(conv).charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                {getConversationName(conv)}
                                            </h3>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-dark-300 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-dark-200 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-100 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        disabled={selectedIds.size === 0}
                        onClick={handleForward}
                        className="px-5 py-2 text-sm font-medium text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        Gửi {selectedIds.size > 0 && `(${selectedIds.size})`}
                    </button>
                </div>
            </div>
        </div>
    )
}
