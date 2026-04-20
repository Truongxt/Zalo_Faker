import { useEffect, useMemo, useState, useRef, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    X, UserPlus, LogOut, UserMinus, Link2, RefreshCw, Pin, Megaphone,
    Copy, Users, Settings2, ClipboardCheck, Crown, Shield, CheckCircle2,
    XCircle, ChevronDown, UserCheck, Edit2, Check, Camera
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore, Conversation, GroupPermissionScope } from '@/stores/chatStore'
import {
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    transferAdmin,
    appointDeputy,
    revokeDeputy,
    dissolveGroup,
    getFriends,
    getGroupSettings,
    rotateGroupInviteCode,
    updateGroupInviteSettings,
    getGroupJoinRequests,
    reviewGroupJoinRequest,
    updateGroupPermissions,
    renameGroup,
    updateGroupAvatar,
    uploadMedia,
} from '@/services/api'

interface GroupManagementModalProps {
    isOpen: boolean
    onClose: () => void
    group: Conversation | null
}

type PermissionOption = {
    value: GroupPermissionScope
    label: string
}

const permissionOptions: PermissionOption[] = [
    { value: 'all', label: 'Tất cả thành viên' },
    { value: 'admin_deputy', label: 'Admin + Phó nhóm' },
    { value: 'admin', label: 'Chỉ Admin' },
]

type LocalGroupSettings = {
    invite: {
        code: string
        approvalRequired: boolean
        inviteUrl: string
    }
    permissions: {
        sendMedia: GroupPermissionScope
        pinMessage: GroupPermissionScope
        sendAnnouncement: GroupPermissionScope
    }
    pendingJoinRequests: Array<{
        requestId: string
        userId: string
        requestedAt: string
        status: 'pending' | 'approved' | 'rejected'
    }>
}

const fallbackSettings: LocalGroupSettings = {
    invite: {
        code: '',
        approvalRequired: true,
        inviteUrl: '',
    },
    permissions: {
        sendMedia: 'all',
        pinMessage: 'admin_deputy',
        sendAnnouncement: 'admin_deputy',
    },
    pendingJoinRequests: [],
}

const getUserId = (user: any): string => String(user?.id || user?._id || user?.userId || '')

const AVATAR_COLORS = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
]

const getAvatarColor = (name: string) => {
    const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length
    return AVATAR_COLORS[idx]
}

const getRoleConfig = (role: string) => {
    switch (role) {
        case 'admin':
            return { label: 'Trưởng nhóm', icon: Crown, color: 'text-amber-500' }
        case 'deputy':
            return { label: 'Phó nhóm', icon: Shield, color: 'text-blue-500' }
        default:
            return { label: 'Thành viên', icon: UserCheck, color: 'text-gray-400' }
    }
}

export default function GroupManagementModal({ isOpen, onClose, group }: GroupManagementModalProps) {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { updateConversation, removeConversation, setActiveConversation } = useChatStore()

    const [allUsers, setAllUsers] = useState<any[]>([])
    const [showAddMember, setShowAddMember] = useState(false)
    const [selectedNewMember, setSelectedNewMember] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [settings, setSettings] = useState<LocalGroupSettings>(fallbackSettings)
    const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null)
    const [isEditingName, setIsEditingName] = useState(false)
    const [newName, setNewName] = useState('')
    const [selectedAdminTransferUserId, setSelectedAdminTransferUserId] = useState('')
    const [showAdminLeavePanel, setShowAdminLeavePanel] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!isOpen || !group || !user) return

        const loadUsersAndSettings = async () => {
            try {
                const [friendsData, latestSettings, joinRequests] = await Promise.all([
                    getFriends(user.id),
                    group.id && group.id !== 'undefined' ? getGroupSettings(group.id) : null,
                    group.id && group.id !== 'undefined' ? getGroupJoinRequests(group.id).catch(() => ({ requests: [] })) : { requests: [] },
                ])

                const uniqueFriends = Array.from(
                    new Map((friendsData || []).map((f: any) => [String(f.id || f.userId || f._id), f])).values()
                )
                setAllUsers(uniqueFriends as any[])
                
                if (latestSettings) {
                    setSettings({
                        invite: {
                            code: latestSettings?.invite?.code || '',
                            approvalRequired: Boolean(latestSettings?.invite?.approvalRequired),
                            inviteUrl: latestSettings?.invite?.inviteUrl || '',
                        },
                        permissions: {
                            sendMedia: latestSettings?.permissions?.sendMedia || 'all',
                            pinMessage: latestSettings?.permissions?.pinMessage || 'admin_deputy',
                            sendAnnouncement: latestSettings?.permissions?.sendAnnouncement || 'admin_deputy',
                        },
                        pendingJoinRequests: joinRequests?.requests || latestSettings?.pendingJoinRequests || [],
                    })

                    updateConversation(group.id, {
                        groupSettings: {
                            invite: {
                                code: latestSettings?.invite?.code || '',
                                approvalRequired: Boolean(latestSettings?.invite?.approvalRequired),
                            },
                            joinRequests: joinRequests?.requests || latestSettings?.pendingJoinRequests || [],
                            permissions: {
                                sendMedia: latestSettings?.permissions?.sendMedia || 'all',
                                pinMessage: latestSettings?.permissions?.pinMessage || 'admin_deputy',
                                sendAnnouncement: latestSettings?.permissions?.sendAnnouncement || 'admin_deputy',
                            },
                            pinnedMessage: latestSettings?.pinnedMessage || null,
                        }
                    })
                }
            } catch (error) {
                console.error('Error loading group settings:', error)
            }
        }

        loadUsersAndSettings()
    }, [isOpen, group?.id, user?.id, updateConversation])

    useEffect(() => {
        if (!isOpen) {
            setShowAdminLeavePanel(false)
            setSelectedAdminTransferUserId('')
        }
    }, [isOpen, group?.id])

    const participantsMap = useMemo(() => {
        const map = new Map<string, any>()
        allUsers.forEach((u) => {
            const id = getUserId(u)
            if (id) map.set(id, u)
        })
        return map
    }, [allUsers])

    if (!isOpen || !user || !group) return null

    const currentUserParticipant = group.participants.find((p) => p.userId === user.id)
    const isAdmin = currentUserParticipant?.role === 'admin'
    const canReviewRequests = currentUserParticipant?.role === 'admin' || currentUserParticipant?.role === 'deputy'

    const availableUsersToAdd = allUsers.filter((u) =>
        !group.participants.some((p) => p.userId === getUserId(u))
    )

    const transferCandidates = group.participants.filter(
        (participant) => String(participant.userId) !== String(user.id)
    )

    const syncParticipants = (participants: Conversation['participants'] | undefined) => {
        if (participants) {
            updateConversation(group.id, { participants })
        }
    }

    const copyToClipboard = async (value: string, field: 'code' | 'link') => {
        if (!value) return
        try {
            await navigator.clipboard.writeText(value)
            setCopiedField(field)
            setTimeout(() => setCopiedField(null), 2000)
        } catch {
            alert('Không thể sao chép. Hãy copy thủ công.')
        }
    }

    const syncGroupSettingsToStore = (nextSettings: LocalGroupSettings) => {
        updateConversation(group.id, {
            groupSettings: {
                invite: {
                    code: nextSettings.invite.code,
                    approvalRequired: nextSettings.invite.approvalRequired,
                },
                joinRequests: nextSettings.pendingJoinRequests,
                permissions: nextSettings.permissions,
                pinnedMessage: group.groupSettings?.pinnedMessage || null,
            }
        })
    }

    const handleAddMember = async () => {
        if (!selectedNewMember) return
        try {
            setIsLoading(true)
            const res = await addGroupMember(group.id, {
                userId: user.id,
                newUserId: selectedNewMember
            })
            if (res.participants) {
                updateConversation(group.id, { participants: res.participants })
            }
            const nextSettings = {
                ...settings,
                pendingJoinRequests: settings.pendingJoinRequests.filter((r) => r.userId !== selectedNewMember),
            }
            setSettings(nextSettings)
            syncGroupSettingsToStore(nextSettings)
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
            const res = await removeGroupMember(group.id, { userId: user.id, removeUserId })
            syncParticipants(res.group?.participants)
        } catch (error: any) {
            alert(error.message || 'Lỗi khi xóa thành viên')
        } finally {
            setIsLoading(false)
        }
    }

    const finalizeGroupExit = () => {
        setActiveConversation(null)
        removeConversation(group.id)
        onClose()
        navigate('/chat')
    }

    const handleTransferAdmin = async (newAdminUserId: string) => {
        const targetParticipant = group.participants.find(
            (participant) => String(participant.userId) === String(newAdminUserId)
        )
        const targetName =
            targetParticipant?.fullName ||
            participantsMap.get(String(newAdminUserId))?.fullName ||
            participantsMap.get(String(newAdminUserId))?.userName ||
            'thành viên này'

        if (!confirm(`Chuyển quyền trưởng nhóm cho ${targetName}?`)) return

        try {
            setIsLoading(true)
            const res = await transferAdmin(group.id, { userId: user.id, newAdminUserId })
            syncParticipants(res.group?.participants)
            if (String(selectedAdminTransferUserId) === String(newAdminUserId)) {
                setSelectedAdminTransferUserId('')
            }
        } catch (error: any) {
            alert(error.message || 'Không thể chuyển quyền trưởng nhóm')
        } finally {
            setIsLoading(false)
        }
    }

    const handleToggleDeputy = async (participant: Conversation['participants'][number]) => {
        const isDeputy = participant.role === 'deputy'

        try {
            setIsLoading(true)
            const res = isDeputy
                ? await revokeDeputy(group.id, {
                    userId: user.id,
                    deputyUserId: String(participant.userId),
                })
                : await appointDeputy(group.id, {
                    userId: user.id,
                    deputyUserId: String(participant.userId),
                })
            syncParticipants(res.group?.participants)
        } catch (error: any) {
            alert(
                error.message ||
                (isDeputy ? 'Không thể thu hồi quyền phó nhóm' : 'Không thể cấp quyền phó nhóm')
            )
        } finally {
            setIsLoading(false)
        }
    }

    const handleLeaveGroup = async () => {
        if (isAdmin && !showAdminLeavePanel) {
            setShowAdminLeavePanel(true)
            return
        }

        return handleLeaveGroupWithAdminRules()
        if (!confirm('Bạn có chắc muốn rời nhóm này?')) return
        try {
            setIsLoading(true)
            return
        } catch (error: any) {
            alert(error.message || 'Lỗi khi rời nhóm')
        } finally {
            setIsLoading(false)
        }
    }

    const handleLeaveGroupWithAdminRules = async () => {
        if (!confirm('Bạn có chắc muốn rời nhóm này?')) return
        if (isAdmin && !selectedAdminTransferUserId) {
            alert('Hãy chọn một trưởng nhóm mới trước khi rời nhóm.')
            return
        }

        try {
            setIsLoading(true)
            await leaveGroup(group.id, {
                userId: user.id,
                newAdminUserId: isAdmin ? selectedAdminTransferUserId : undefined,
            })
            setShowAdminLeavePanel(false)
            finalizeGroupExit()
        } catch (error: any) {
            alert(error.message || 'Lỗi khi rời nhóm')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDissolveGroup = async () => {
        if (!confirm('Bạn có chắc muốn giải tán nhóm này?')) return

        try {
            setIsLoading(true)
            await dissolveGroup(group.id, { userId: user.id })
            finalizeGroupExit()
        } catch (error: any) {
            alert(error.message || 'Không thể giải tán nhóm')
        } finally {
            setIsLoading(false)
        }
    }

    const handleRotateInvite = async () => {
        try {
            setIsLoading(true)
            const result = await rotateGroupInviteCode(group.id)
            const nextSettings = {
                ...settings,
                invite: {
                    code: result.invite?.code || settings.invite.code,
                    approvalRequired: result.invite?.approvalRequired ?? settings.invite.approvalRequired,
                    inviteUrl: result.invite?.inviteUrl || settings.invite.inviteUrl,
                }
            }
            setSettings(nextSettings)
            syncGroupSettingsToStore(nextSettings)
        } catch (error: any) {
            alert(error.message || 'Không thể tạo lại mã mới')
        } finally {
            setIsLoading(false)
        }
    }

    const handleToggleInviteApproval = async (checked: boolean) => {
        try {
            setIsLoading(true)
            const result = await updateGroupInviteSettings(group.id, { approvalRequired: checked })
            const nextSettings = {
                ...settings,
                invite: {
                    code: result.invite?.code || settings.invite.code,
                    approvalRequired: result.invite?.approvalRequired ?? checked,
                    inviteUrl: result.invite?.inviteUrl || settings.invite.inviteUrl,
                }
            }
            setSettings(nextSettings)
            syncGroupSettingsToStore(nextSettings)
        } catch (error: any) {
            alert(error.message || 'Không thể cập nhật cài đặt mời')
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdatePermission = async (key: 'sendMedia' | 'pinMessage' | 'sendAnnouncement', value: GroupPermissionScope) => {
        try {
            setIsLoading(true)
            const result = await updateGroupPermissions(group.id, { [key]: value })
            const nextSettings = {
                ...settings,
                permissions: { ...settings.permissions, ...(result.permissions || {}) }
            }
            setSettings(nextSettings)
            syncGroupSettingsToStore(nextSettings)
        } catch (error: any) {
            alert(error.message || 'Không thể cập nhật quyền')
        } finally {
            setIsLoading(false)
        }
    }

    const handleReviewRequest = async (requestId: string, action: 'approve' | 'reject') => {
        try {
            setIsLoading(true)
            const result = await reviewGroupJoinRequest(group.id, requestId, action)
            if (result.group?.participants) {
                updateConversation(group.id, { participants: result.group.participants })
            }
            const nextSettings = {
                ...settings,
                pendingJoinRequests: settings.pendingJoinRequests.filter((r) => r.requestId !== requestId),
            }
            setSettings(nextSettings)
            syncGroupSettingsToStore(nextSettings)
        } catch (error: any) {
            alert(error.message || 'Không thể duyệt yêu cầu')
        } finally {
            setIsLoading(false)
        }
    }

    const getParticipantName = (participant: { userId: string; fullName?: string }) => {
        if (participant.fullName) return participant.fullName
        const userInfo = participantsMap.get(participant.userId)
        return userInfo?.fullName || userInfo?.userName || `User ${participant.userId}`
    }

    const getRequestName = (requestUserId: string) => {
        const userInfo = participantsMap.get(requestUserId)
        return userInfo?.fullName || userInfo?.userName || `User ${requestUserId}`
    }

    const handleStartEditingName = () => {
        setNewName(group.name || '')
        setIsEditingName(true)
    }

    const handleSaveName = async () => {
        if (!newName.trim() || newName === group.name) {
            setIsEditingName(false)
            return
        }

        try {
            setIsLoading(true)
            await renameGroup(group.id, newName.trim())
            updateConversation(group.id, { name: newName.trim() })
            setIsEditingName(false)
        } catch (error: any) {
            alert(error.message || 'Không thể đổi tên nhóm')
        } finally {
            setIsLoading(false)
        }
    }

    const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setIsLoading(true)
            const uploadRes = await uploadMedia(file)
            const avatarUrl = uploadRes.url

            await updateGroupAvatar(group.id, { avatar: avatarUrl })
            updateConversation(group.id, { avatar: avatarUrl })
        } catch (error: any) {
            alert(error.message || 'Không thể đổi ảnh đại diện')
        } finally {
            setIsLoading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
                style={{ maxHeight: '90vh', boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}
            >
                {/* Header */}
                <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-primary-600 to-primary-500 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarChange}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="group relative w-10 h-10 rounded-xl overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 hover:border-white/60 transition-all shadow-lg"
                        >
                            {group.avatar ? (
                                <img src={group.avatar} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            ) : (
                                <Settings2 className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="w-4 h-4 text-white" />
                            </div>
                        </button>
                        <div className="flex-1">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 bg-white/20 text-white placeholder-white/60 border-none rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-white/30 focus:outline-none"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveName()
                                            if (e.key === 'Escape') setIsEditingName(false)
                                        }}
                                    />
                                    <button onClick={handleSaveName} className="p-1 hover:bg-white/20 rounded">
                                        <Check className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-base font-bold text-white leading-tight">Quản trị nhóm</h2>
                                        <p className="text-xs text-primary-100 truncate max-w-[200px]">{group.name || 'Nhóm của bạn'}</p>
                                    </div>
                                    <button
                                        onClick={handleStartEditingName}
                                        className="p-1 hover:bg-white/20 rounded opacity-70 hover:opacity-100"
                                    >
                                        <Edit2 className="w-3 h-3 text-white" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-950">

                    {/* ── Invite Link Card ── */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                    <Link2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Link mời nhóm</span>
                            </div>
                            {(isAdmin || canReviewRequests) && (
                                <button
                                    onClick={handleRotateInvite}
                                    disabled={isLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Tạo lại mã
                                </button>
                            )}
                        </div>

                        <div className="px-4 py-3 space-y-2.5">
                            {/* Code row */}
                            <div className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Mã mời</p>
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 font-mono tracking-widest">
                                        {settings.invite.code || '–––––'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(settings.invite.code, 'code')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        copiedField === 'code'
                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : 'bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50'
                                    }`}
                                >
                                    {copiedField === 'code' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedField === 'code' ? 'Đã copy!' : 'Copy'}
                                </button>
                            </div>

                            {/* Link row */}
                            <div className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Link tham gia</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                        {settings.invite.inviteUrl || '(đang tải...)'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(settings.invite.inviteUrl, 'link')}
                                    className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        copiedField === 'link'
                                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : 'bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-500 hover:bg-gray-50'
                                    }`}
                                >
                                    {copiedField === 'link' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedField === 'link' ? 'Đã copy!' : 'Copy'}
                                </button>
                            </div>

                            {/* Approval toggle */}
                            {canReviewRequests && (
                                <div className="flex items-center justify-between px-1 pt-1">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Bắt buộc duyệt thành viên mới</span>
                                    <button
                                        onClick={() => handleToggleInviteApproval(!settings.invite.approvalRequired)}
                                        disabled={isLoading}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                                            settings.invite.approvalRequired ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                settings.invite.approvalRequired ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Permissions Card ── */}
                    {isAdmin && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                                    <Settings2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Phân quyền nhóm</span>
                            </div>

                            <div className="px-4 py-3 space-y-3">
                                {([
                                    { key: 'sendMedia' as const, emoji: '🖼️', label: 'Gửi ảnh / video / file / sticker', value: settings.permissions.sendMedia },
                                    { key: 'pinMessage' as const, icon: <Pin className="w-3.5 h-3.5 text-violet-500" />, label: 'Ghim tin nhắn', value: settings.permissions.pinMessage },
                                    { key: 'sendAnnouncement' as const, icon: <Megaphone className="w-3.5 h-3.5 text-violet-500" />, label: 'Gửi thông báo nhóm', value: settings.permissions.sendAnnouncement },
                                ] as Array<{ key: 'sendMedia' | 'pinMessage' | 'sendAnnouncement'; emoji?: string; icon?: ReactNode; label: string; value: GroupPermissionScope }>).map(({ key, emoji, icon, label, value }) => (
                                    <div key={key} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="flex-shrink-0 text-sm">{emoji ?? icon}</span>
                                            <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{label}</span>
                                        </div>
                                        <div className="relative flex-shrink-0">
                                            <select
                                                className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors"
                                                value={value}
                                                onChange={(e) => handleUpdatePermission(key, e.target.value as GroupPermissionScope)}
                                            >
                                                {permissionOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Join Requests Card ── */}
                    {canReviewRequests && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                        <ClipboardCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Yêu cầu tham gia</span>
                                </div>
                                {settings.pendingJoinRequests.length > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full">
                                        {settings.pendingJoinRequests.length}
                                    </span>
                                )}
                            </div>

                            <div className="px-4 py-3">
                                {settings.pendingJoinRequests.length === 0 ? (
                                    <div className="flex flex-col items-center py-5 text-gray-400">
                                        <ClipboardCheck className="w-8 h-8 mb-2 opacity-30" />
                                        <p className="text-sm">Không có yêu cầu nào chờ duyệt</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {settings.pendingJoinRequests.map((request) => {
                                            const name = getRequestName(request.userId)
                                            return (
                                                <div
                                                    key={request.requestId}
                                                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center flex-shrink-0`}>
                                                            <span className="text-white text-xs font-bold">{name.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{name}</p>
                                                            <p className="text-[11px] text-gray-400">{new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <button
                                                            onClick={() => handleReviewRequest(request.requestId, 'reject')}
                                                            disabled={isLoading}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            Từ chối
                                                        </button>
                                                        <button
                                                            onClick={() => handleReviewRequest(request.requestId, 'approve')}
                                                            disabled={isLoading}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            Chấp nhận
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Members Card ── */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                    <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Thành viên</span>
                                <span className="px-1.5 py-0.5 text-[11px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                                    {group.participants.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowAddMember((prev) => !prev)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                Thêm
                            </button>
                        </div>

                        {/* Add member form */}
                        {showAddMember && (
                            <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                                <div className="relative mb-2">
                                    <select
                                        className="w-full appearance-none pl-3 pr-8 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
                                        value={selectedNewMember}
                                        onChange={(e) => setSelectedNewMember(e.target.value)}
                                    >
                                        <option value="">-- Chọn người để thêm --</option>
                                        {availableUsersToAdd.map((u) => {
                                            const id = getUserId(u)
                                            return (
                                                <option key={id} value={id}>
                                                    {u.fullName || u.userName || id}
                                                </option>
                                            )
                                        })}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                                <button
                                    onClick={handleAddMember}
                                    disabled={!selectedNewMember || isLoading}
                                    className="w-full py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                                >
                                    {isLoading ? 'Đang thêm...' : 'Xác nhận thêm'}
                                </button>
                            </div>
                        )}

                        {/* Members list */}
                        <div className="px-3 py-2 space-y-0.5">
                            {group.participants.map((participant) => {
                                const isMe = participant.userId === user.id
                                const canManage =
                                    !isMe &&
                                    (isAdmin ||
                                        (currentUserParticipant?.role === 'deputy' && participant.role === 'member'))
                                const canRemove = canManage
                                const name = getParticipantName(participant)
                                const roleConfig = getRoleConfig(participant.role || 'member')
                                const RoleIcon = roleConfig.icon

                                return (
                                    <div
                                        key={participant.userId}
                                        className="flex items-center justify-between px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Avatar */}
                                            <div className={`relative w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center flex-shrink-0 ring-2 ring-white dark:ring-gray-800 shadow-sm`}>
                                                <span className="text-white text-sm font-bold">{name.charAt(0).toUpperCase()}</span>
                                                {participant.role === 'admin' && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                                        <Crown className="w-2 h-2 text-white" />
                                                    </span>
                                                )}
                                                {participant.role === 'deputy' && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                                        <Shield className="w-2 h-2 text-white" />
                                                    </span>
                                                )}
                                            </div>

                                            {/* Name & role */}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {name}
                                                    {isMe && <span className="ml-1.5 text-xs font-normal text-gray-400">(Bạn)</span>}
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <RoleIcon className={`w-3 h-3 ${roleConfig.color}`} />
                                                    <span className={`text-[11px] font-medium ${roleConfig.color}`}>{roleConfig.label}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {canManage && isAdmin && (
                                            <div className="mr-2 flex flex-col items-end gap-1.5">
                                                <button
                                                    onClick={() => handleToggleDeputy(participant)}
                                                    disabled={isLoading}
                                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                                >
                                                    {participant.role === 'deputy' ? 'Thu hồi phó nhóm' : 'Cấp phó nhóm'}
                                                </button>
                                                <button
                                                    onClick={() => handleTransferAdmin(String(participant.userId))}
                                                    disabled={isLoading}
                                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                                >
                                                    Chuyển trưởng nhóm
                                                </button>
                                            </div>
                                        )}

                                        {/* Remove button */}
                                        {canRemove && (
                                            <button
                                                onClick={() => handleRemoveMember(participant.userId)}
                                                disabled={isLoading}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-lg transition-all disabled:opacity-50"
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
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 space-y-3">
                    {isAdmin && showAdminLeavePanel && (
                        <div className="space-y-2">
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                    Rời nhóm với quyền trưởng nhóm
                                </p>
                                <p className="mt-1 text-xs text-amber-700/90">
                                    Bạn phải chọn một thành viên để chuyển quyền trưởng nhóm trước khi rời nhóm.
                                </p>
                            </div>
                            <div className="relative">
                                <select
                                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                                    value={selectedAdminTransferUserId}
                                    onChange={(e) => setSelectedAdminTransferUserId(e.target.value)}
                                >
                                    <option value="">-- Chọn trưởng nhóm mới --</option>
                                    {transferCandidates.map((participant) => (
                                        <option key={participant.userId} value={String(participant.userId)}>
                                            {getParticipantName(participant)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            </div>
                            <button
                                onClick={() => {
                                    setShowAdminLeavePanel(false)
                                    setSelectedAdminTransferUserId('')
                                }}
                                disabled={isLoading}
                                className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                            >
                                Hủy chuyển quyền
                            </button>
                            <button
                                onClick={() => {
                                    setShowAdminLeavePanel(false)
                                    setSelectedAdminTransferUserId('')
                                }}
                                disabled={isLoading}
                                className="hidden"
                            >
                                Giải tán nhóm
                            </button>
                        </div>
                    )}
                    {isAdmin && (
                        <button
                            onClick={handleDissolveGroup}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors disabled:opacity-40"
                        >
                            <XCircle className="w-4 h-4" />
                            Giải tán nhóm
                        </button>
                    )}
                    <button
                        onClick={handleLeaveGroup}
                        disabled={isLoading || group.participants.length === 1}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-red-500 border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    >
                        <LogOut className="w-4 h-4" />
                        Rời nhóm
                    </button>
                </div>
            </div>
        </div>
    )
}
