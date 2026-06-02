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
    getUserById,
    getGroupSettings,
    rotateGroupInviteCode,
    updateGroupInviteSettings,
    getGroupJoinRequests,
    reviewGroupJoinRequest,
    updateGroupPermissions,
    renameGroup,
    updateGroupAvatar,
    uploadMedia,
    updateParticipantSetting,
} from '@/services/api'
import { friendsService } from '@/services/friendsService'
import socketService from '@/lib/socket'

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
        sendMessage: GroupPermissionScope
        sendMedia: GroupPermissionScope
        startCall: GroupPermissionScope
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
        sendMessage: 'all',
        sendMedia: 'all',
        startCall: 'all',
        pinMessage: 'admin_deputy',
        sendAnnouncement: 'admin_deputy',
    },
    pendingJoinRequests: [],
}

type MemberRelationState =
    | 'self'
    | 'friend'
    | 'pending_sent'
    | 'pending_received'
    | 'blocked_by_me'
    | 'blocked_by_them'
    | 'none'

const getUserId = (user: any): string => String(user?.id || user?._id || user?.userId || '')
const pickDisplayName = (...values: Array<unknown>) => {
    for (const value of values) {
        const text = String(value ?? '').trim()
        if (text) return text
    }
    return ''
}

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
    const [memberRelations, setMemberRelations] = useState<Record<string, MemberRelationState>>({})
    const [editingNicknameUserId, setEditingNicknameUserId] = useState<string | null>(null)
    const [editingNicknameValue, setEditingNicknameValue] = useState('')
    const [activeTab, setActiveTab] = useState<'members' | 'invite' | 'permissions' | 'danger'>('members')
    const [searchMemberQuery, setSearchMemberQuery] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const inviteQrValue = useMemo(() => {
        const inviteUrl = String(settings?.invite?.inviteUrl || '').trim()
        if (inviteUrl) return inviteUrl

        const inviteCode = String(settings?.invite?.code || '').trim()
        if (inviteCode) return `groupInvite:${inviteCode}`

        return ''
    }, [settings?.invite?.inviteUrl, settings?.invite?.code])

    const inviteQrSrc = useMemo(() => {
        if (!inviteQrValue) return ''
        return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteQrValue)}`
    }, [inviteQrValue])

    const filteredParticipants = useMemo(() => {
        if (!searchMemberQuery.trim()) return group?.participants || []
        return (group?.participants || []).filter((p) => {
            const name = getParticipantName(p).toLowerCase()
            return name.includes(searchMemberQuery.toLowerCase())
        })
    }, [group?.participants, searchMemberQuery])

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

                const participantIds = (group.participants || []).map((participant) => String(participant.userId))
                const requesterIds = (joinRequests?.requests || []).map((request: any) => String(request.userId))
                const existingIds = new Set((uniqueFriends as any[]).map((friend) => getUserId(friend)))
                const neededIds = Array.from(new Set([...participantIds, ...requesterIds]))
                    .filter((uid) => uid && !existingIds.has(uid))

                const fetchedUsers = await Promise.all(
                    neededIds.map((uid) => getUserById(uid).catch(() => null))
                )

                const mergedUsers = Array.from(
                    new Map(
                        [...uniqueFriends, ...fetchedUsers.filter(Boolean)].map((u: any) => [getUserId(u), u])
                    ).values()
                )
                setAllUsers(mergedUsers as any[])

                const acceptedFriendIds = new Set(
                    uniqueFriends
                        .map((friend: any) => String(friend.id || friend.userId || friend._id || ''))
                        .filter(Boolean)
                )
                const relationEntries = await Promise.all(
                    participantIds
                        .filter((participantId) => participantId && participantId !== String(user.id))
                        .map(async (participantId) => {
                            if (acceptedFriendIds.has(participantId)) {
                                return [participantId, 'friend'] as const
                            }

                            const relation = await friendsService
                                .checkFriendship(String(user.id), participantId)
                                .catch(() => null)

                            if (!relation) {
                                return [participantId, 'none'] as const
                            }

                            const relationStatus = String((relation as any).status || '').toLowerCase()
                            if (relationStatus === 'accepted') return [participantId, 'friend'] as const
                            if (relationStatus === 'pending') {
                                return [
                                    participantId,
                                    String((relation as any).fromUserId) === String(user.id)
                                        ? 'pending_sent'
                                        : 'pending_received',
                                ] as const
                            }
                            if (relationStatus === 'blocked') {
                                return [
                                    participantId,
                                    String((relation as any).fromUserId) === String(user.id)
                                        ? 'blocked_by_me'
                                        : 'blocked_by_them',
                                ] as const
                            }

                            return [participantId, 'none'] as const
                        })
                )

                setMemberRelations(
                    relationEntries.reduce<Record<string, MemberRelationState>>((acc, [participantId, state]) => {
                        acc[participantId] = state
                        return acc
                    }, {})
                )
                
                if (latestSettings) {
                    setSettings({
                        invite: {
                            code: latestSettings?.invite?.code || '',
                            approvalRequired: Boolean(latestSettings?.invite?.approvalRequired),
                            inviteUrl: latestSettings?.invite?.inviteUrl || '',
                        },
                        permissions: {
                            sendMessage: latestSettings?.permissions?.sendMessage || 'all',
                            sendMedia: latestSettings?.permissions?.sendMedia || 'all',
                            startCall: latestSettings?.permissions?.startCall || 'all',
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
                                sendMessage: latestSettings?.permissions?.sendMessage || 'all',
                                sendMedia: latestSettings?.permissions?.sendMedia || 'all',
                                startCall: latestSettings?.permissions?.startCall || 'all',
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
    }, [isOpen, group?.id, group?.participants, user?.id, updateConversation])

    useEffect(() => {
        if (!isOpen) {
            setShowAdminLeavePanel(false)
            setSelectedAdminTransferUserId('')
        }
    }, [isOpen, group?.id])

    useEffect(() => {
        if (!isOpen || !group || !user) return

        const handleConversationUpdated = async (payload: any) => {
            if (String(payload?.id || '') !== String(group.id)) return
            if (!payload?.groupSettings && !payload?.participants) return

            try {
                const effectiveParticipants = payload?.participants || group.participants || []
                const currentRole = effectiveParticipants.find((p: any) => String(p.userId) === String(user.id))?.role
                const canReview = currentRole === 'admin' || currentRole === 'deputy'
                const [latestSettings, joinRequests] = await Promise.all([
                    getGroupSettings(group.id),
                    canReview ? getGroupJoinRequests(group.id).catch(() => ({ requests: [] })) : Promise.resolve({ requests: [] }),
                ])

                const nextSettings: LocalGroupSettings = {
                    invite: {
                        code: latestSettings?.invite?.code || '',
                        approvalRequired: Boolean(latestSettings?.invite?.approvalRequired),
                        inviteUrl: latestSettings?.invite?.inviteUrl || '',
                    },
                    permissions: {
                        sendMessage: latestSettings?.permissions?.sendMessage || 'all',
                        sendMedia: latestSettings?.permissions?.sendMedia || 'all',
                        startCall: latestSettings?.permissions?.startCall || 'all',
                        pinMessage: latestSettings?.permissions?.pinMessage || 'admin_deputy',
                        sendAnnouncement: latestSettings?.permissions?.sendAnnouncement || 'admin_deputy',
                    },
                    pendingJoinRequests: canReview
                        ? (joinRequests as any)?.requests || latestSettings?.pendingJoinRequests || []
                        : [],
                }

                setSettings(nextSettings)
                updateConversation(group.id, {
                    participants: effectiveParticipants,
                    groupSettings: {
                        invite: {
                            code: nextSettings.invite.code,
                            approvalRequired: nextSettings.invite.approvalRequired,
                        },
                        joinRequests: nextSettings.pendingJoinRequests,
                        permissions: nextSettings.permissions,
                        pinnedMessage:
                            latestSettings?.pinnedMessage ||
                            payload?.groupSettings?.pinnedMessage ||
                            group.groupSettings?.pinnedMessage ||
                            null,
                    }
                })
            } catch (error) {
                console.error('Realtime group settings refresh failed:', error)
            }
        }

        socketService.on('chat:update_conversation', handleConversationUpdated)

        return () => {
            socketService.off('chat:update_conversation', handleConversationUpdated)
        }
    }, [isOpen, group, user, updateConversation])

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

    const handleUpdatePermission = async (
        key: 'sendMessage' | 'sendMedia' | 'startCall' | 'pinMessage' | 'sendAnnouncement',
        value: GroupPermissionScope
    ) => {
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

    const handleSendFriendRequest = async (targetUserId: string) => {
        if (!user?.id || !targetUserId || isLoading) return

        try {
            setIsLoading(true)
            await friendsService.sendFriendRequest(
                String(user.id),
                String(targetUserId),
                'Xin chào, mình muốn kết bạn với bạn trong nhóm chat.'
            )
            setMemberRelations((prev) => ({
                ...prev,
                [String(targetUserId)]: 'pending_sent',
            }))
        } catch (error: any) {
            alert(error?.message || 'Không thể gửi lời mời kết bạn')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancelFriendRequest = async (targetUserId: string) => {
        if (!user?.id || !targetUserId || isLoading) return

        try {
            setIsLoading(true)
            await friendsService.cancelFriendRequest(String(user.id), String(targetUserId))
            setMemberRelations((prev) => ({
                ...prev,
                [String(targetUserId)]: 'none',
            }))
        } catch (error: any) {
            alert(error?.message || 'Không thể hủy lời mời kết bạn')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetNickname = async (targetUserId: string, newNickname: string) => {
        try {
            setIsLoading(true);
            const res = await updateParticipantSetting(group.id, targetUserId, { nickname: newNickname.trim() });
            if (res.participants) {
                updateConversation(group.id, { participants: res.participants });
            }
            setEditingNicknameUserId(null);
            setEditingNicknameValue('');
        } catch (error: any) {
            alert(error.message || 'Không thể cập nhật biệt danh');
        } finally {
            setIsLoading(false);
        }
    };

    const getParticipantName = (participant: { userId: string; fullName?: string }) => {
        const userInfo = participantsMap.get(String(participant.userId))
        return (
            pickDisplayName(
                (participant as any).nickname,
                participant.fullName,
                (participant as any).userName,
                (participant as any).name,
                userInfo?.fullName,
                userInfo?.userName,
                userInfo?.name
            ) || `User ${participant.userId}`
        )
    }

    const getParticipantAvatar = (participant: { userId: string; avatarUrl?: string | null }) => {
        const userInfo = participantsMap.get(String(participant.userId))
        return (participant as any)?.avatarUrl || userInfo?.avatarUrl || userInfo?.avartarUrl || null
    }

    const getMemberRelationState = (participantUserId: string): MemberRelationState => {
        if (String(participantUserId) === String(user?.id)) return 'self'
        return memberRelations[String(participantUserId)] || 'none'
    }

    const getMemberRelationLabel = (relationState: MemberRelationState) => {
        if (relationState === 'friend') return 'Bạn bè'
        if (relationState === 'pending_sent') return 'Đã gửi lời mời'
        if (relationState === 'pending_received') return 'Đã nhận lời mời'
        if (relationState === 'blocked_by_me') return 'Bạn đã chặn'
        if (relationState === 'blocked_by_them') return 'Bị chặn'
        return ''
    }

    const getRequestName = (requestUserId: string) => {
        const userInfo = participantsMap.get(String(requestUserId))
        const participant = (group?.participants || []).find(
            (item) => String(item.userId) === String(requestUserId)
        )
        return (
            pickDisplayName(
                (participant as any)?.nickname,
                participant?.fullName,
                (participant as any)?.userName,
                userInfo?.fullName,
                userInfo?.userName,
                userInfo?.name
            ) || `User ${requestUserId}`
        )
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
                className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl h-[650px] overflow-hidden flex flex-col"
                style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}
            >
                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-500 flex-shrink-0">
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
                            className="group relative w-12 h-12 rounded-xl overflow-hidden bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 hover:border-white/60 transition-all shadow-lg flex-shrink-0"
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
                        <div className="min-w-0">
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        className="bg-white/20 text-white placeholder-white/60 border-none rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-white/30 focus:outline-none"
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
                                        <h2 className="text-lg font-bold text-white leading-tight">Quản trị nhóm</h2>
                                        <p className="text-xs text-primary-100 truncate max-w-[300px]">{group.name || 'Nhóm của bạn'}</p>
                                    </div>
                                    <button
                                        onClick={handleStartEditingName}
                                        className="p-1 hover:bg-white/20 rounded opacity-70 hover:opacity-100"
                                    >
                                        <Edit2 className="w-3.5 h-3.5 text-white" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* 2-Column Body */}
                <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-950">
                    {/* Sidebar Tabs */}
                    <div className="w-60 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col justify-between flex-shrink-0">
                        <div className="space-y-3">
                            <button
                                onClick={() => setActiveTab('members')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    activeTab === 'members'
                                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
                                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
                                }`}
                            >
                                <Users className="w-4 h-4" />
                                <span>Thành viên</span>
                                <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full">
                                    {group.participants.length}
                                </span>
                            </button>

                            <button
                                onClick={() => setActiveTab('invite')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    activeTab === 'invite'
                                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
                                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
                                }`}
                            >
                                <Link2 className="w-4 h-4" />
                                <span>Mã & Link mời</span>
                                {settings.pendingJoinRequests.length > 0 && (
                                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full animate-pulse">
                                        {settings.pendingJoinRequests.length}
                                    </span>
                                )}
                            </button>

                            {isAdmin && (
                                <button
                                    onClick={() => setActiveTab('permissions')}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                        activeTab === 'permissions'
                                            ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
                                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
                                    }`}
                                >
                                    <Settings2 className="w-4 h-4" />
                                    <span>Phân quyền nhóm</span>
                                </button>
                            )}
                        </div>

                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => setActiveTab('danger')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    activeTab === 'danger'
                                        ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                                        : 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20'
                                }`}
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Rời / Giải tán nhóm</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
                        {activeTab === 'members' && (
                            <div className="space-y-6">
                                {/* Search and Add Actions */}
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm thành viên..."
                                            value={searchMemberQuery}
                                            onChange={(e) => setSearchMemberQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                                        />
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    </div>
                                    <button
                                        onClick={() => setShowAddMember((prev) => !prev)}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Thêm thành viên
                                    </button>
                                </div>

                                {/* Add Member Panel */}
                                {showAddMember && (
                                    <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3 shadow-sm">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Thêm thành viên mới</p>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <select
                                                    className="w-full appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
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
                                                className="px-5 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                                            >
                                                {isLoading ? 'Đang thêm...' : 'Xác nhận'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Members List */}
                                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Danh sách thành viên ({filteredParticipants.length})</p>
                                    </div>
                                    <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[380px] overflow-y-auto">
                                        {filteredParticipants.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400">
                                                Không tìm thấy thành viên nào
                                            </div>
                                        ) : (
                                            filteredParticipants.map((participant) => {
                                                const isMe = participant.userId === user.id
                                                const canManage =
                                                    !isMe &&
                                                    (isAdmin ||
                                                        (currentUserParticipant?.role === 'deputy' && participant.role === 'member'))
                                                const canRemove = canManage
                                                const name = getParticipantName(participant)
                                                const avatarUrl = getParticipantAvatar(participant)
                                                const relationState = getMemberRelationState(String(participant.userId))
                                                const relationLabel = getMemberRelationLabel(relationState)
                                                const roleConfig = getRoleConfig(participant.role || 'member')
                                                const RoleIcon = roleConfig.icon

                                                return (
                                                    <div
                                                        key={participant.userId}
                                                        className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            {/* Avatar */}
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/profile/${participant.userId}`)}
                                                                className={`relative w-10 h-10 overflow-hidden rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center flex-shrink-0 ring-2 ring-white dark:ring-gray-800 shadow-sm`}
                                                                title={`Xem trang cá nhân của ${name}`}
                                                            >
                                                                {avatarUrl ? (
                                                                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <span className="text-white text-sm font-bold">{name.charAt(0).toUpperCase()}</span>
                                                                )}
                                                                {participant.role === 'admin' && (
                                                                    <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                                                        <Crown className="w-2.5 h-2.5 text-white" />
                                                                    </span>
                                                                )}
                                                                {participant.role === 'deputy' && (
                                                                    <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-blue-400 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                                                        <Shield className="w-2.5 h-2.5 text-white" />
                                                                    </span>
                                                                )}
                                                            </button>

                                                            {/* Name & Role Info */}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                                        {name}
                                                                    </p>
                                                                    {isMe && <span className="px-1.5 py-0.5 text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-md font-bold uppercase tracking-wider">Bạn</span>}
                                                                </div>

                                                                {editingNicknameUserId === participant.userId ? (
                                                                    <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                                                                        <input
                                                                            type="text"
                                                                            autoFocus
                                                                            placeholder="Nhập biệt danh..."
                                                                            value={editingNicknameValue}
                                                                            onChange={(e) => setEditingNicknameValue(e.target.value)}
                                                                            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    handleSetNickname(participant.userId, editingNicknameValue);
                                                                                } else if (e.key === 'Escape') {
                                                                                    setEditingNicknameUserId(null);
                                                                                }
                                                                            }}
                                                                        />
                                                                        <button
                                                                            onClick={() => handleSetNickname(participant.userId, editingNicknameValue)}
                                                                            className="p-1 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingNicknameUserId(null)}
                                                                            className="p-1 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                                                            <RoleIcon className={`w-2.5 h-2.5 ${roleConfig.color}`} />
                                                                            <span className={roleConfig.color}>{roleConfig.label}</span>
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-300 dark:text-gray-700">•</span>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingNicknameUserId(participant.userId);
                                                                                setEditingNicknameValue((participant as any).nickname || '');
                                                                            }}
                                                                            className="text-[10px] text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 font-semibold flex items-center gap-0.5"
                                                                        >
                                                                            <Edit2 className="w-2.5 h-2.5" />
                                                                            {(participant as any).nickname ? 'Đổi biệt danh' : 'Đặt biệt danh'}
                                                                        </button>
                                                                        {(participant as any).nickname && (
                                                                            <>
                                                                                <span className="text-[10px] text-gray-300 dark:text-gray-700">•</span>
                                                                                <button
                                                                                    onClick={() => handleSetNickname(participant.userId, '')}
                                                                                    className="text-[10px] text-red-400 hover:text-red-500 font-semibold"
                                                                                >
                                                                                    Xóa biệt danh
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {!isMe && relationLabel && (
                                                                    <p className="mt-0.5 text-[10px] text-gray-400 font-medium">{relationLabel}</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Right Actions */}
                                                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                                            {!isMe && relationState === 'none' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSendFriendRequest(String(participant.userId))}
                                                                    disabled={isLoading}
                                                                    className="flex h-7 px-3 items-center justify-center gap-1 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400 text-xs font-semibold disabled:opacity-50"
                                                                    title={`Kết bạn với ${name}`}
                                                                >
                                                                    <UserPlus className="h-3.5 w-3.5" />
                                                                    <span>Kết bạn</span>
                                                                </button>
                                                            )}
                                                            {!isMe && relationState === 'pending_sent' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCancelFriendRequest(String(participant.userId))}
                                                                    disabled={isLoading}
                                                                    className="flex h-7 px-3 items-center justify-center gap-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 text-xs font-semibold disabled:opacity-50"
                                                                    title={`Hủy lời mời kết bạn với ${name}`}
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                    <span>Hủy lời mời</span>
                                                                </button>
                                                            )}

                                                            {canManage && isAdmin && (
                                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => handleToggleDeputy(participant)}
                                                                        disabled={isLoading}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors disabled:opacity-50"
                                                                        title="Cấp quyền nhóm phó"
                                                                        aria-label="Cấp quyền nhóm phó"
                                                                    >
                                                                        <Shield className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleTransferAdmin(String(participant.userId))}
                                                                        disabled={isLoading}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-colors disabled:opacity-50"
                                                                        title="Chuyển quyền nhóm trưởng"
                                                                        aria-label="Chuyển quyền nhóm trưởng"
                                                                    >
                                                                        <Crown className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Remove Member Button */}
                                                            {canRemove && (
                                                                <button
                                                                    onClick={() => handleRemoveMember(participant.userId)}
                                                                    disabled={isLoading}
                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 rounded-lg transition-all disabled:opacity-50"
                                                                    title="Xóa khỏi nhóm"
                                                                >
                                                                    <UserMinus className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'invite' && (
                            <div className="space-y-5">
                                {/* Link Mời Card */}
                                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                                <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Link mời nhóm</span>
                                        </div>
                                        {(isAdmin || canReviewRequests) && (
                                            <button
                                                onClick={handleRotateInvite}
                                                disabled={isLoading}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                Tạo lại mã
                                            </button>
                                        )}
                                    </div>

                                    {/* Code & Link Rows */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 flex flex-col justify-between border border-gray-100 dark:border-gray-800">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mã mời</p>
                                                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 font-mono tracking-wider">
                                                    {settings.invite.code || '–––––'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(settings.invite.code, 'code')}
                                                className={`mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                    copiedField === 'code'
                                                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                            >
                                                {copiedField === 'code' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                {copiedField === 'code' ? 'Đã copy!' : 'Copy mã'}
                                            </button>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 flex flex-col justify-between border border-gray-100 dark:border-gray-800">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Link tham gia</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                                    {settings.invite.inviteUrl || '(đang tải...)'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => copyToClipboard(settings.invite.inviteUrl, 'link')}
                                                className={`mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                    copiedField === 'link'
                                                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                            >
                                                {copiedField === 'link' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                {copiedField === 'link' ? 'Đã copy!' : 'Copy Link'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* QR Code and Member Approval Setup */}
                                    <div className="grid grid-cols-12 gap-4 items-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                                        {inviteQrSrc && (
                                            <div className="col-span-4 flex justify-center">
                                                <div className="w-28 h-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white p-1.5 flex items-center justify-center shadow-sm">
                                                    <img
                                                        src={inviteQrSrc}
                                                        alt="QR mời tham gia nhóm"
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div className="col-span-8 space-y-2">
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Mã QR tham gia nhóm</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                                Chia sẻ mã QR để thành viên khác trực tiếp quét và xin tham gia vào nhóm trò chuyện.
                                            </p>
                                        </div>
                                    </div>

                                    {canReviewRequests && (
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Bắt buộc duyệt thành viên mới</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">Thành viên mới thông qua link mời cần được quản trị viên đồng ý.</p>
                                            </div>
                                            <button
                                                onClick={() => handleToggleInviteApproval(!settings.invite.approvalRequired)}
                                                disabled={isLoading}
                                                className={`relative inline-flex h-6.5 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                                                    settings.invite.approvalRequired ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                        settings.invite.approvalRequired ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Join Requests Panel */}
                                {canReviewRequests && (
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                                                <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Yêu cầu tham gia nhóm chờ duyệt</span>
                                        </div>

                                        <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                            {settings.pendingJoinRequests.length === 0 ? (
                                                <div className="flex flex-col items-center py-6 text-gray-400">
                                                    <ClipboardCheck className="w-10 h-10 mb-2 opacity-30 text-amber-500" />
                                                    <p className="text-xs font-semibold">Không có yêu cầu nào chờ duyệt</p>
                                                </div>
                                            ) : (
                                                settings.pendingJoinRequests.map((request) => {
                                                    const name = getRequestName(request.userId)
                                                    return (
                                                        <div
                                                            key={request.requestId}
                                                            className="flex items-center justify-between gap-3 py-3"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(name)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                                                    <span className="text-white text-xs font-bold">{name.charAt(0).toUpperCase()}</span>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{name}</p>
                                                                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(request.requestedAt).toLocaleString('vi-VN')}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <button
                                                                    onClick={() => handleReviewRequest(request.requestId, 'reject')}
                                                                    disabled={isLoading}
                                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors disabled:opacity-50"
                                                                >
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                    Từ chối
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReviewRequest(request.requestId, 'approve')}
                                                                    disabled={isLoading}
                                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors disabled:opacity-50"
                                                                >
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                    Duyệt
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'permissions' && isAdmin && (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                                        <Settings2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Quyền hạn của thành viên</span>
                                </div>

                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {([
                                        { key: 'sendMessage' as const, emoji: '💬', label: 'Gửi tin nhắn', value: settings.permissions.sendMessage },
                                        { key: 'sendMedia' as const, emoji: '🖼️', label: 'Gửi hình ảnh, video và tệp tin', value: settings.permissions.sendMedia },
                                        { key: 'startCall' as const, emoji: '📞', label: 'Gọi thoại & cuộc gọi nhóm', value: settings.permissions.startCall },
                                        { key: 'pinMessage' as const, icon: <Pin className="w-4 h-4 text-violet-500" />, label: 'Ghim tin nhắn nhóm', value: settings.permissions.pinMessage },
                                        { key: 'sendAnnouncement' as const, icon: <Megaphone className="w-4 h-4 text-violet-500" />, label: 'Tạo thông báo quan trọng', value: settings.permissions.sendAnnouncement },
                                    ] as Array<{ key: 'sendMessage' | 'sendMedia' | 'startCall' | 'pinMessage' | 'sendAnnouncement'; emoji?: string; icon?: ReactNode; label: string; value: GroupPermissionScope }>).map(({ key, emoji, icon, label, value }) => (
                                        <div key={key} className="flex items-center justify-between gap-4 py-5">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="flex-shrink-0 text-base">{emoji ?? icon}</span>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{label}</span>
                                            </div>
                                            <div className="relative flex-shrink-0">
                                                <select
                                                    className="appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors"
                                                    value={value}
                                                    onChange={(e) => handleUpdatePermission(key, e.target.value as GroupPermissionScope)}
                                                >
                                                    {permissionOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'danger' && (
                            <div className="space-y-4">
                                <div className="bg-red-50/50 dark:bg-red-950/10 rounded-2xl border border-red-100 dark:border-red-900/30 p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                                            <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                                        </div>
                                        <span className="text-sm font-bold text-red-800 dark:text-red-300">Vùng nguy hiểm</span>
                                    </div>
                                    <p className="text-xs text-red-700/80 dark:text-red-400/80 leading-relaxed">
                                        Mọi hành động rời khỏi hoặc giải tán nhóm chat này sẽ có hiệu lực vĩnh viễn. Vui lòng cân nhắc kỹ trước khi thực hiện.
                                    </p>

                                    {isAdmin && showAdminLeavePanel && (
                                        <div className="space-y-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-900/30">
                                            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                                Ủy quyền Trưởng nhóm mới trước khi rời đi
                                            </p>
                                            <p className="text-xs text-amber-600 dark:text-amber-500">
                                                Bạn phải chọn một thành viên khác để giao lại quyền Trưởng nhóm trước khi rời khỏi nhóm.
                                            </p>
                                            <div className="relative">
                                                <select
                                                    className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
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
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setShowAdminLeavePanel(false)
                                                        setSelectedAdminTransferUserId('')
                                                    }}
                                                    disabled={isLoading}
                                                    className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
                                                >
                                                    Hủy
                                                </button>
                                                <button
                                                    onClick={handleLeaveGroup}
                                                    disabled={!selectedAdminTransferUserId || isLoading}
                                                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                                                >
                                                    Chuyển quyền & Rời nhóm
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {!showAdminLeavePanel && (
                                        <div className="space-y-3">
                                            {isAdmin && (
                                                <button
                                                    onClick={handleDissolveGroup}
                                                    disabled={isLoading}
                                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors disabled:opacity-40"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Giải tán nhóm
                                                </button>
                                            )}
                                            <button
                                                onClick={handleLeaveGroup}
                                                disabled={isLoading || group.participants.length === 1}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-red-500 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Rời nhóm
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
