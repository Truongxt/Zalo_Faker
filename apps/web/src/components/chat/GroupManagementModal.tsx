import { useState, useEffect } from 'react'
import { X, UserPlus, LogOut, ShieldAlert, UserMinus } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore, Conversation } from '@/stores/chatStore'
import { addGroupMember, removeGroupMember, leaveGroup, getUsers } from '@/services/api'

interface GroupManagementModalProps {
    isOpen: boolean
    onClose: () => void
    group: Conversation
}

export default function GroupManagementModal({ isOpen, onClose, group }: GroupManagementModalProps) {
    const { user } = useAuthStore()
    const { updateConversation, removeConversation, setActiveConversation } = useChatStore()
    
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [showAddMember, setShowAddMember] = useState(false)
    const [selectedNewMember, setSelectedNewMember] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (isOpen && showAddMember && allUsers.length === 0) {
            getUsers().then(setAllUsers).catch(console.error)
        }
    }, [isOpen, showAddMember])

    if (!isOpen || !user) return null

    const currentUserParticipant = group.participants.find(p => p.userId === user.id)
    const isAdmin = currentUserParticipant?.role === 'admin'

    const handleAddMember = async () => {
        if (!selectedNewMember) return
        try {
            setIsLoading(true)
            const res = await addGroupMember(group.id, {
                userId: user.id,
                newUserId: selectedNewMember
            })
            // Update local store
            if (res.participants) {
                updateConversation(group.id, { participants: res.participants })
            }
            setShowAddMember(false)
            setSelectedNewMember('')
        } catch (error: any) {
            alert(error.message || 'Lỗi khi thêm thành viên')
        } finally {
            setIsLoading(false)
        }
    }

    const handleRemoveMember = async (removeUserId: string) => {
        if (!confirm('Bạn có chắc muốn xóa thành viên này?')) return
        try {
            setIsLoading(true)
            const res = await removeGroupMember(group.id, {
                userId: user.id,
                removeUserId
            })
            if (res.group?.participants) {
                updateConversation(group.id, { participants: res.group.participants })
            }
        } catch (error: any) {
            alert(error.message || 'Lỗi khi xóa thành viên')
        } finally {
            setIsLoading(false)
        }
    }

    const handleLeaveGroup = async () => {
        if (!confirm('Bạn có chắc muốn rời nhóm này?')) return
        try {
            setIsLoading(true)
            await leaveGroup(group.id, { userId: user.id })
            
            // Xóa conversation khỏi local list & chuyển về màn hình rỗng
            setActiveConversation(null)
            removeConversation(group.id)
            onClose()
        } catch (error: any) {
            alert(error.message || 'Lỗi khi rời nhóm')
        } finally {
            setIsLoading(false)
        }
    }

    const availableUsersToAdd = allUsers.filter(u => 
        !group.participants.some(p => p.userId === (u.id || u._id))
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-dark-200">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quản trị nhóm</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">Thành viên ({group.participants.length})</h3>
                        <button 
                            onClick={() => setShowAddMember(!showAddMember)}
                            className="p-1.5 bg-primary-100 hover:bg-primary-200 text-primary-600 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors"
                        >
                            <UserPlus className="w-4 h-4" /> Thêm
                        </button>
                    </div>

                    {showAddMember && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-300 rounded-xl border border-gray-200 dark:border-gray-700">
                            <select 
                                className="w-full p-2 mb-2 bg-white dark:bg-dark-100 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none"
                                value={selectedNewMember}
                                onChange={(e) => setSelectedNewMember(e.target.value)}
                            >
                                <option value="">-- Chọn người liên hệ --</option>
                                {availableUsersToAdd.map(u => (
                                    <option key={u.id || u._id} value={u.id || u._id}>{u.fullName}</option>
                                ))}
                            </select>
                            <button 
                                onClick={handleAddMember}
                                disabled={!selectedNewMember || isLoading}
                                className="w-full py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
                            >
                                Xác nhận thêm
                            </button>
                        </div>
                    )}

                    <div className="space-y-2">
                        {group.participants.map(p => {
                            const isMe = p.userId === user.id
                            return (
                                <div key={p.userId} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-dark-300 rounded-xl transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                            <span className="text-primary-600 dark:text-primary-400 font-medium">
                                                {p.fullName?.charAt(0).toUpperCase() || 'U'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-1">
                                                {p.fullName} {isMe && '(Bạn)'}
                                                {p.role === 'admin' && (
                                                    <span title="Trưởng nhóm" className="flex items-center">
                                                        <ShieldAlert className="w-3 h-3 text-yellow-500" />
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500 capitalize">{p.role}</p>
                                        </div>
                                    </div>
                                    
                                    {!isMe && isAdmin && (
                                        <button 
                                            onClick={() => handleRemoveMember(p.userId)}
                                            disabled={isLoading}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Xóa khỏi nhóm"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-300">
                    <button 
                        onClick={handleLeaveGroup}
                        disabled={isLoading || (group.participants.length === 1)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        <LogOut className="w-5 h-5" />
                        Rời nhóm
                    </button>
                </div>
            </div>
        </div>
    )
}
