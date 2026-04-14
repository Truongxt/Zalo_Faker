import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
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
    Bot,
    Pin,
    BellOff,
    Tag,
    Link2,
    Clock,
    UserPlus,
    EyeOff,
    Eye,
    Key,
    Lock,
    X
} from 'lucide-react'
import authService from '@/services/auth'
import CreateGroupModal from '@/components/chat/CreateGroupModal'
import LabelManagerModal from '@/components/chat/LabelManagerModal'
import LabelPickerModal from '@/components/chat/LabelPickerModal'
import MuteConversationModal from '@/components/chat/MuteConversationModal'
import { updateParticipantSetting, getLabels, joinGroupByInviteCode } from '@/services/api'
import AddFriendModal from '@/components/friends/AddFriendModal'
import { formatMuteUntilLabel, getParticipantMuteState } from '@/lib/muteUtils'

export default function Sidebar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, updateProfile } = useAuthStore()
    const { 
        conversations, 
        activeConversation, 
        setActiveConversation, 
        addConversation, 
        unlockedHiddenChats, 
        setUnlockedHiddenChats,
        updateConversation
    } = useChatStore()

    const isContactsView = location.pathname.startsWith('/chat/contacts')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'groups'>('all')
    const [showCreateGroup, setShowCreateGroup] = useState(false)
    const [showAddFriend, setShowAddFriend] = useState(false)
    const [showLabelManager, setShowLabelManager] = useState(false)
    const [labelPickerConv, setLabelPickerConv] = useState<Conversation | null>(null)
    const [mutePickerConv, setMutePickerConv] = useState<Conversation | null>(null)
    const [activeLabelId, setActiveLabelId] = useState<string | null>(null)
    const [showPinSetup, setShowPinSetup] = useState(false)
    const [setupPinCode, setSetupPinCode] = useState('')
    const [isSettingPin, setIsSettingPin] = useState(false)
    const [hidingConv, setHidingConv] = useState<Conversation | null>(null)
    const [showPinChange, setShowPinChange] = useState(false)
    const [oldPin, setOldPin] = useState('')
    const [newPin, setNewPin] = useState('')
    const [isChangingPin, setIsChangingPin] = useState(false)
    const [isResetMode, setIsResetMode] = useState(false)
    const [loginPassword, setLoginPassword] = useState('')

    const [, setMinuteTick] = useState(() => Date.now())
    const { labels, setLabels } = useChatStore()

    useEffect(() => {
        if (user) {
            getLabels().then(setLabels).catch(console.error)
        }
    }, [user, setLabels])

    useEffect(() => {
        const timer = window.setInterval(() => setMinuteTick(Date.now()), 60000)
        return () => window.clearInterval(timer)
    }, [])

    const filteredConversations = conversations.filter(conv => {
        const participants = conv.participants || []
        const currentP = participants.find(p => String(p.userId) === String(user?.id))

        // Hidden filter behavior
        if (unlockedHiddenChats) {
            // IF UNLOCKED: SHOW ONLY HIDDEN
            if (!currentP?.isHidden) return false
        } else {
            // IF LOCKED: HIDE ALL HIDDEN
            if (currentP?.isHidden) return false
        }

        // Search filter
        if (searchQuery) {
            const other = participants.find(p => String(p.userId) !== String(user?.id))
            const name = conv.type === 'group'
                ? conv.name
                : (other?.nickname || other?.fullName)
            if (!name?.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false
            }
        }

        // Tab filter
        if (activeTab === 'unread' && conv.unreadCount === 0) return false
        if (activeTab === 'groups' && conv.type !== 'group') return false

        // Label filter
        if (activeLabelId) {
            const currentP = participants.find(p => String(p.userId) === String(user?.id))
            if (!currentP?.labelIds?.includes(activeLabelId)) return false
        }

        return true
    })

    const getConversationName = (conv: Conversation) => {
        const participants = conv.participants || []
        const currentP = participants.find(p => String(p.userId) === String(user?.id))
        if (currentP?.nickname) return currentP.nickname

        if (conv.type === 'group') return conv.name || 'Nhóm chat'
        const other = participants.find(p => String(p.userId) !== String(user?.id))
        return other?.fullName || 'Người dùng'
    }

    const getConversationAvatar = (conv: Conversation) => {
        const participants = conv.participants || []
        if (conv.type === 'group') return conv.avatar
        const other = participants.find(p => String(p.userId) !== String(user?.id))
        return other?.avatarUrl
    }

    const getOnlineStatus = (conv: Conversation) => {
        const participants = conv.participants || []
        if (conv.type === 'group') return false
        const other = participants.find(p => String(p.userId) !== String(user?.id))
        return other?.status === 'online'
    }

    const handleConversationClick = (conv: Conversation) => {
        setActiveConversation(conv)
        navigate(`/chat/${conv.id}`)
    }

    const handleJoinByInvite = async () => {
        const code = prompt('Nhập mã mời nhóm:')
        if (!code?.trim() || !user) return

        try {
            const result = await joinGroupByInviteCode(code.trim())

            if (result.status === 'joined' && result.group) {
                const joinedGroup = { ...result.group, id: result.group._id }
                addConversation(joinedGroup)
                setActiveConversation(joinedGroup)
                navigate(`/chat/${joinedGroup.id}`)
                alert('Đã tham gia nhóm thành công.')
                return
            }

            if (result.status === 'requested' || result.status === 'pending') {
                alert('Đã gửi yêu cầu tham gia nhóm. Vui lòng chờ duyệt.')
                return
            }

            alert(result.message || 'Đã xử lý yêu cầu.')
        } catch (error: any) {
            alert(error.message || 'Không thể tham gia nhóm bằng mã mời.')
        }
    }

    const handleTogglePin = async (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation()
        if (!user) return
        const participants = conv.participants || []
        const p = participants.find(p => p.userId === user.id)
        const isPinned = !(p?.isPinned)
        try {
            await updateParticipantSetting(conv.id, user.id, { isPinned })
            useChatStore.getState().updateConversation(conv.id, {
                participants: participants.map(part =>
                    String(part.userId) === String(user.id) ? { ...part, isPinned } : part
                )
            })
        } catch (error) {
            console.error(error)
        }
    }

    const handleSearchChange = async (value: string) => {
        setSearchQuery(value)

        // Web PIN verification (detect 6-digit number)
        if (value.length === 6 && /^\d+$/.test(value) && user?.id) {
            try {
                const res = await authService.verifyHiddenPin(user.id, value)
                if (res.success) {
                    setUnlockedHiddenChats(true)
                    setSearchQuery('')
                    alert('Đã hiện các cuộc trò chuyện bị ẩn')
                }
            } catch (err) {
                // Ignore, maybe just searching for "123456"
            }
        }
    }

    const handleToggleHide = async (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation()
        if (!user) return

        if (!user.hasHiddenPin) {
            setHidingConv(conv)
            setShowPinSetup(true)
            return
        }

        const currentP = conv.participants?.find(p => p.userId === user.id)
        const isCurrentlyHidden = currentP?.isHidden === true

        if (isCurrentlyHidden) {
            // Unhide
            try {
                await updateParticipantSetting(conv.id, user.id, { isHidden: false })
                updateConversation(conv.id, {
                    participants: (conv.participants || []).map(p =>
                        p.userId === user.id ? { ...p, isHidden: false } : p
                    )
                })
                alert('Đã bỏ ẩn cuộc trò chuyện')
            } catch (err) {
                alert('Không thể bỏ ẩn cuộc trò chuyện')
            }
        } else {
            // Hide
            if (confirm('Bạn có muốn ẩn cuộc trò chuyện này? Để tìm lại, hãy nhập mã PIN vào ô tìm kiếm.')) {
                try {
                    await updateParticipantSetting(conv.id, user.id, { isHidden: true })
                    updateConversation(conv.id, {
                        participants: (conv.participants || []).map(p =>
                            p.userId === user.id ? { ...p, isHidden: true } : p
                        )
                    })
                } catch (err) {
                    alert('Không thể ẩn cuộc trò chuyện')
                }
            }
        }
    }

    const handleUpdatePin = async () => {
        if (!user?.id) return;
        
        if (isResetMode) {
            if (!loginPassword || newPin.length !== 6) {
                alert('Vui lòng nhập mật khẩu đăng nhập và mã PIN mới (6 số)')
                return
            }
        } else {
            if (oldPin.length !== 6 || newPin.length !== 6) {
                alert('Vui lòng nhập đủ 6 số cho cả mã cũ và mới')
                return
            }
        }

        try {
            setIsChangingPin(true)
            if (isResetMode) {
                // Reset using login password
                const res = await authService.resetHiddenPin(user.id, loginPassword, newPin)
                if (res.success) {
                    alert('Đã đặt lại mã PIN mới bằng mật khẩu đăng nhập thành công')
                    setShowPinChange(false)
                    setIsResetMode(false)
                    setLoginPassword('')
                    setNewPin('')
                } else {
                    alert(res.message || 'Xác thực mật khẩu đăng nhập thất bại')
                }
            } else {
                // Normal change
                const verify = await authService.verifyHiddenPin(user.id, oldPin)
                if (!verify.success) {
                    alert('Mã PIN cũ không chính xác')
                    return
                }

                await authService.updateHiddenPin(user.id, newPin)
                alert('Đã đổi mã PIN mới thành công')
                setShowPinChange(false)
                setOldPin('')
                setNewPin('')
            }
        } catch (err) {
            alert('Lỗi khi cập nhật mã PIN')
        } finally {
            setIsChangingPin(false)
        }
    }

    const handleSavePin = async () => {
        if (!user?.id || setupPinCode.length !== 6) {
            alert('Mã PIN phải có 6 chữ số')
            return
        }

        try {
            setIsSettingPin(true)
            await authService.updateHiddenPin(user.id, setupPinCode)
            updateProfile({ hasHiddenPin: true })
            setShowPinSetup(false)
            setSetupPinCode('')
            
            if (hidingConv) {
                // If we were in the middle of hiding a conv
                const isHidden = true
                await updateParticipantSetting(hidingConv.id, user.id, { isHidden })
                updateConversation(hidingConv.id, {
                    participants: (hidingConv.participants || []).map(p =>
                        p.userId === user.id ? { ...p, isHidden } : p
                    )
                })
                setHidingConv(null)
                alert('Đã đặt mã PIN và ẩn cuộc trò chuyện.')
            } else {
                alert('Đã thiết lập mã PIN thành công.')
            }
        } catch (err) {
            alert('Lỗi khi thiết lập mã PIN')
        } finally {
            setIsSettingPin(false)
        }
    }

    const hasLockedHidden = conversations.some(conv => {
        const p = conv.participants?.find(p => p.userId === user?.id)
        return p?.isHidden && !unlockedHiddenChats
    })

    const applyMuteSettings = async (conv: Conversation, settings: { isMuted: boolean; muteUntil: string | null }) => {
        if (!user) return
        const participants = conv.participants || []
        const nextParticipantState = {
            isMuted: settings.isMuted,
            muteUntil: settings.isMuted ? settings.muteUntil : null
        }

        try {
            await updateParticipantSetting(conv.id, user.id, nextParticipantState)
            useChatStore.getState().updateConversation(conv.id, {
                participants: participants.map(part =>
                    String(part.userId) === String(user.id) ? { ...part, ...nextParticipantState } : part
                )
            })
        } catch (err) {
            console.error('Error updating mute settings:', err)
        }
    }

    const handleToggleMute = async (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation()
        if (!user) return

        const participants = conv.participants || []
        const currentP = participants.find(p => String(p.userId) === String(user.id))
        const muteState = getParticipantMuteState(currentP)

        if (muteState.isMuted) {
            await applyMuteSettings(conv, { isMuted: false, muteUntil: null })
            return
        }

        setMutePickerConv(conv)
    }

    const sortedConversations = [...filteredConversations].sort((a, b) => {
        const pA = (a.participants || []).find(p => String(p.userId) === String(user?.id))
        const pB = (b.participants || []).find(p => String(p.userId) === String(user?.id))

        if (pA?.isPinned && !pB?.isPinned) return -1
        if (!pA?.isPinned && pB?.isPinned) return 1

        const timeA = a.updatedAt || a.lastMessage?.timestamp || 0
        const timeB = b.updatedAt || b.lastMessage?.timestamp || 0
        return new Date(timeB).getTime() - new Date(timeA).getTime()
    })

    return (
        <div className="sidebar flex flex-col h-full bg-white dark:bg-dark-100 border-r border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {isContactsView ? 'Danh bạ' : 'Tin nhắn'}
                    </h1>
                    {!isContactsView && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowAddFriend(true)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                                title="Thêm bạn"
                            >
                                <UserPlus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleJoinByInvite}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                                title="Tham gia nhóm bằng mã mời"
                            >
                                <Link2 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setShowCreateGroup(true)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                                title="Tạo nhóm"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                            {user?.hasHiddenPin && (
                                <button
                                    onClick={() => setShowPinChange(true)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                                    title="Đổi mã PIN ẩn"
                                >
                                    <Key className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}
                    {isContactsView && (
                        <button
                            onClick={() => setShowAddFriend(true)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                            title="Thêm bạn"
                        >
                            <UserPlus className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className={`relative group/search ${hasLockedHidden ? 'theme-hidden' : ''}`}>
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                        hasLockedHidden ? 'text-red-500' : 'text-gray-400 group-focus-within/search:text-primary-500'
                    }`} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Tìm kiếm"
                        className={`w-full pl-10 pr-10 py-2 rounded-lg 
                        text-gray-900 dark:text-white placeholder-gray-500
                        focus:outline-none focus:ring-2 transition-all duration-300 ${
                            hasLockedHidden 
                            ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 focus:ring-red-500' 
                            : 'bg-gray-100 dark:bg-dark-300 border-transparent focus:ring-primary-500'
                        }`}
                    />
                    {unlockedHiddenChats && (
                         <button
                            onClick={() => {
                                setUnlockedHiddenChats(false)
                                setSearchQuery('')
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-primary-500"
                            title="Thoát chế độ ẩn"
                         >
                            <X className="w-4 h-4" />
                         </button>
                    )}
                </div>

                {/* Tabs & Labels (Only show in Chat view) */}
                {!isContactsView && (
                    <>
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

                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide items-center">
                            <button
                                onClick={() => setShowLabelManager(true)}
                                className="px-2 py-1 flex-shrink-0 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-300 whitespace-nowrap"
                            >
                                + Quản lý nhãn
                            </button>
                            {labels.map(lbl => (
                                <button
                                    key={lbl._id}
                                    onClick={() => setActiveLabelId(activeLabelId === lbl._id ? null : lbl._id)}
                                    className="px-3 py-1 flex-shrink-0 text-xs rounded-full border whitespace-nowrap transition-colors"
                                    style={{
                                        borderColor: lbl.color,
                                        backgroundColor: activeLabelId === lbl._id ? lbl.color : 'transparent',
                                        color: activeLabelId === lbl._id ? '#fff' : lbl.color
                                    }}
                                >
                                    {lbl.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-2">
                {isContactsView ? (
                    /* Contacts Menu Items */
                    <div className="space-y-1">
                        <Link to="/chat/contacts" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname === '/chat/contacts' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300'}`}>
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <span className="font-medium">Lời mời kết bạn</span>
                        </Link>
                        <Link to="/chat/contacts" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="font-medium">Danh sách nhóm</span>
                        </Link>
                        <Link to="/chat/contacts" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <span className="font-medium">Danh sách bạn bè</span>
                        </Link>
                    </div>
                ) : (
                    /* Chat/Conversation List */
                    <>
                        <button
                            className="w-full flex items-center gap-3 p-3 mb-2 bg-gradient-to-r from-primary-500/10 to-purple-500/10 
                               border border-primary-200 dark:border-primary-800 rounded-xl hover:from-primary-500/20 hover:to-purple-500/20 transition-all text-left"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-sm">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">AI Trợ lý</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Hỏi bất cứ điều gì</p>
                            </div>
                        </button>

                        {sortedConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                                <p className="text-sm">Chưa có cuộc trò chuyện</p>
                            </div>
                        ) : (
                            sortedConversations.map((conv) => {
                                const participants = conv.participants || []
                                const currentP = participants.find(p => String(p.userId) === String(user?.id))
                                const isPinned = currentP?.isPinned
                                const muteState = getParticipantMuteState(currentP)
                                const isMuted = muteState.isMuted
                                const muteTitle = isMuted
                                    ? `Đã tắt thông báo ${formatMuteUntilLabel(muteState.muteUntil)}`
                                    : 'Tắt thông báo'

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() => handleConversationClick(conv)}
                                        className={`chat-item w-full flex items-center gap-3 relative group cursor-pointer ${activeConversation?.id === conv.id ? 'active' : ''
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
                                                <h3 className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-1">
                                                    {getConversationName(conv)}
                                                    {isMuted && (
                                                        <span title={muteTitle}>
                                                            <BellOff className="w-3 h-3 text-gray-400" />
                                                        </span>
                                                    )}
                                                    {currentP?.labelIds?.slice(0, 2).map((lid: string) => {
                                                        const label = labels.find((l: any) => l._id === lid)
                                                        if (!label) return null
                                                        return <Tag key={lid} className="w-3 h-3 flex-shrink-0" style={{ color: label.color, fill: label.color }} title={label.name} />
                                                    })}
                                                </h3>
                                                <div className="flex items-center gap-1">
                                                    {isPinned && <Pin className="w-3 h-3 text-primary-500" />}
                                                    {conv.lastMessage && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                                            {formatDistanceToNow(new Date(conv.lastMessage.timestamp), {
                                                                addSuffix: false,
                                                                locale: vi
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                                    {conv.lastMessage?.content || 'Bắt đầu cuộc trò chuyện'}
                                                </p>
                                                {conv.unreadCount > 0 && !isMuted && (
                                                    <span className="badge flex-shrink-0 ml-2">
                                                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Hover Actions */}
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-dark-300 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center p-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setLabelPickerConv(conv); }}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500"
                                                title="Phân loại"
                                            >
                                                <Tag className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => handleTogglePin(e, conv)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500"
                                                title={isPinned ? 'Bỏ ghim' : 'Ghim'}
                                            >
                                                <Pin className={`w-4 h-4 ${isPinned ? 'fill-primary-500 text-primary-500' : ''}`} />
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleHide(e, conv)}
                                                className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors ${
                                                    currentP?.isHidden ? 'text-primary-500' : 'text-red-500'
                                                }`}
                                                title={currentP?.isHidden ? 'Bỏ ẩn trò chuyện' : 'Ẩn trò chuyện'}
                                            >
                                                {currentP?.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleMute(e, conv)}
                                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500"
                                                title={isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
                                            >
                                                <BellOff className={`w-4 h-4 ${isMuted ? 'text-red-500' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </>
                )}
            </div>

            {/* Bottom navigation */}
            <div className="border-t border-gray-200 dark:border-gray-800 p-2 flex-shrink-0">
                <div className="flex items-center justify-around">
                    <Link to="/chat" className={`flex flex-col items-center gap-1 p-2 transition-colors ${!isContactsView && location.pathname !== '/chat/moments' ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500'}`}>
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-xs">Tin nhắn</span>
                    </Link>
                    <Link to="/chat/contacts" className={`flex flex-col items-center gap-1 p-2 transition-colors ${isContactsView ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500'}`}>
                        <Users className="w-5 h-5" />
                        <span className="text-xs">Danh bạ</span>
                    </Link>
                    <Link to="/chat/moments" className={`flex flex-col items-center gap-1 p-2 transition-colors ${location.pathname === '/chat/moments' ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500'}`}>
                        <Clock className="w-5 h-5" />
                        <span className="text-xs">Khoảnh khắc</span>
                    </Link>
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

            {/* Modals */}
            <CreateGroupModal
                isOpen={showCreateGroup}
                onClose={() => setShowCreateGroup(false)}
            />
            <LabelManagerModal
                isOpen={showLabelManager}
                onClose={() => setShowLabelManager(false)}
            />
            {labelPickerConv && (
                <LabelPickerModal
                    conversation={labelPickerConv}
                    isOpen={!!labelPickerConv}
                    onClose={() => setLabelPickerConv(null)}
                />
            )}
            {mutePickerConv && (
                <MuteConversationModal
                    isOpen={!!mutePickerConv}
                    onClose={() => setMutePickerConv(null)}
                    conversation={mutePickerConv}
                />
            )}
            <AddFriendModal
                isOpen={showAddFriend}
                onClose={() => setShowAddFriend(false)}
            />

            {showPinSetup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-dark-200 rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
                                <EyeOff className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cài đặt mã PIN</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                Nhập 6 chữ số để bảo vệ các cuộc trò chuyện bị ẩn. 
                                Bạn sẽ cần mã này để tìm lại chúng sau này.
                            </p>
                            
                            <div className="w-full mb-6">
                                <input
                                    type="password"
                                    maxLength={6}
                                    value={setupPinCode}
                                    onChange={(e) => setSetupPinCode(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full text-center text-3xl tracking-[1em] py-3 bg-gray-100 dark:bg-dark-300 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                                    placeholder="••••••"
                                    autoFocus
                                />
                            </div>

                            <div className="flex w-full gap-3">
                                <button
                                    onClick={() => { setShowPinSetup(false); setSetupPinCode(''); setHidingConv(null); }}
                                    className="flex-1 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-300 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSavePin}
                                    disabled={setupPinCode.length !== 6 || isSettingPin}
                                    className="flex-1 py-2.5 rounded-xl font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/25"
                                >
                                    {isSettingPin ? 'Đang lưu...' : 'Thiết lập'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPinChange && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-dark-200 rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                                <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {isResetMode ? 'Đặt lại mã PIN' : 'Đổi mã PIN ẩn'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                {isResetMode ? 'Vui lòng nhập mật khẩu tài khoản để đặt lại mã PIN.' : 'Vui lòng nhập mã PIN cũ và mã PIN mới để thay đổi.'}
                            </p>
                            
                            <div className="w-full space-y-4 mb-4 text-left">
                                {isResetMode ? (
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Mật khẩu đăng nhập</label>
                                        <input
                                            type="password"
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-300 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                                            placeholder="Nhập mật khẩu App"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Mã PIN cũ</label>
                                        <input
                                            type="password"
                                            maxLength={6}
                                            value={oldPin}
                                            onChange={(e) => setOldPin(e.target.value.replace(/[^0-9]/g, ''))}
                                            className="w-full text-center text-2xl tracking-[0.5em] py-2 bg-gray-100 dark:bg-dark-300 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                                            placeholder="••••••"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase ml-1">Mã PIN mới</label>
                                    <input
                                        type="password"
                                        maxLength={6}
                                        value={newPin}
                                        onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                                        className="w-full text-center text-2xl tracking-[0.5em] py-2 bg-gray-100 dark:bg-dark-300 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                                        placeholder="••••••"
                                    />
                                </div>
                            </div>

                            {!isResetMode && (
                                <div className="w-full text-right mb-6">
                                    <button 
                                        onClick={() => setIsResetMode(true)}
                                        className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                                    >
                                        Quên mã PIN?
                                    </button>
                                </div>
                            )}

                            <div className={`flex w-full gap-3 ${isResetMode ? 'mt-4' : ''}`}>
                                <button
                                    onClick={() => { setShowPinChange(false); setOldPin(''); setNewPin(''); setIsResetMode(false); setLoginPassword(''); }}
                                    className="flex-1 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-300 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleUpdatePin}
                                    disabled={(isResetMode ? !loginPassword : oldPin.length !== 6) || newPin.length !== 6 || isChangingPin}
                                    className="flex-1 py-2.5 rounded-xl font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/25"
                                >
                                    {isChangingPin ? 'Đang xử lý...' : (isResetMode ? 'Đặt lại' : 'Cập nhật')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
