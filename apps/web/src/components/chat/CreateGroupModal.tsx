import { useState, useEffect } from 'react'
import { X, Search, Users, Check } from 'lucide-react'
import { createGroup, getFriends } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { useNavigate } from 'react-router-dom'

interface CreateGroupModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
    const { user } = useAuthStore()
    const { addConversation, setActiveConversation } = useChatStore()
    const navigate = useNavigate()

    const [groupName, setGroupName] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [contacts, setContacts] = useState<any[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    // Lấy danh sách bạn bè
    useEffect(() => {
        if (isOpen && user?.id) {
            setIsLoading(true)
            getFriends(user.id)
                .then((data: any) => {
                    setContacts(data)
                })
                .catch((err: Error) => console.error('Error fetching friends:', err))
                .finally(() => setIsLoading(false))
        } else {
            // Reset state khi bị đóng
            setGroupName('')
            setSearchQuery('')
            setSelectedIds([])
        }
    }, [isOpen, user?.id])

    const filteredContacts = contacts.filter(c => {
        const name = (c.fullName || c.userName || '').toLowerCase()
        const query = searchQuery.toLowerCase()
        const phone = (c.phoneNumber || c.phone || '')
        return name.includes(query) || phone.includes(searchQuery)
    })

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const handleCreateGroup = async () => {
        if (!user) return
        if (!groupName.trim()) {
            alert('Vui lòng nhập tên nhóm')
            return
        }
        if (selectedIds.length < 2) {
            alert('Nhóm cần ít nhất 3 thành viên (bao gồm bạn)')
            return
        }

        try {
            setIsCreating(true)
            const newGroup = await createGroup({
                name: groupName.trim(),
                memberIds: selectedIds,
                createdBy: user.id
            })

            // add conversation to store (map _id to id)
            const groupWithId = {
                ...newGroup,
                id: newGroup.id || newGroup._id,
                unreadCount: 0
            }
            addConversation(groupWithId)
            
            // set active and navigate
            setActiveConversation(groupWithId)
            navigate(`/chat/${groupWithId.id}`)

            onClose()
        } catch (error) {
            console.error('Error creating group:', error)
            alert('Không thể tạo nhóm lúc này.')
        } finally {
            setIsCreating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-dark-200">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tạo nhóm mới</h2>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    {/* Input Tên nhóm */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-dark-300 flex items-center justify-center flex-shrink-0">
                            <Users className="w-6 h-6 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="Nhập tên nhóm..."
                            className="flex-1 border-b border-gray-200 dark:border-gray-700 bg-transparent py-2 focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Search bar */}
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm người liên hệ"
                            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-dark-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-900 dark:text-white placeholder-gray-500"
                        />
                    </div>

                    {/* Danh sách bạn bè */}
                    <div className="flex-1 overflow-y-auto mt-2 min-h-[200px] max-h-[300px]">
                        {isLoading ? (
                            <div className="flex justify-center py-4">
                                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filteredContacts.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                Không tìm thấy người liên hệ nào
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredContacts.map(contact => {
                                    const id = contact.id || contact._id
                                    const isSelected = selectedIds.includes(id)
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => handleToggleSelect(id)}
                                            className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-dark-300 rounded-xl transition-colors text-left"
                                        >
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                isSelected 
                                                    ? 'bg-primary-500 border-primary-500' 
                                                    : 'border-gray-300 dark:border-gray-600'
                                            }`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            
                                            {contact.avatarUrl ? (
                                                <img src={contact.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                                                        {(contact.fullName || contact.userName || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                                    {contact.fullName || contact.userName}
                                                </p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-dark-300">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleCreateGroup}
                        disabled={isCreating || selectedIds.length < 2 || !groupName.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Đang tạo...
                            </>
                        ) : 'Tạo nhóm'}
                    </button>
                </div>
            </div>
        </div>
    )
}
