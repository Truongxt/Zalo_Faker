import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, Loader2, MessageCircle, Video, User as UserIcon } from 'lucide-react'
import MomentCard from '@/components/moments/MomentCard'
import { applyMomentReactionLocally } from '@/components/moments/momentHelpers'
import { useToast } from '@/contexts/ToastContext'
import { useAuthStore } from '@/stores/authStore'
import { useChatStore } from '@/stores/chatStore'
import { momentService } from '@/services/momentService'
import { getConversation } from '@/services/api'
import type { Moment, MomentProfile } from '@/types/moment'

const isVideoUrl = (url?: string | null) => {
    const normalizedUrl = String(url || '')
        .split('?')[0]
        .toLowerCase()
    return ['.mp4', '.mov', '.webm', '.m4v'].some((extension) => normalizedUrl.endsWith(extension))
}

const updateMomentCommentCount = (moments: Moment[], momentId: string, delta: number) =>
    moments.map((moment) =>
        moment.momentId === momentId
            ? { ...moment, commentCount: Math.max(0, moment.commentCount + delta) }
            : moment
    )

export default function UserProfile() {
    const { userId } = useParams<{ userId: string }>()
    const navigate = useNavigate()
    const { addToast } = useToast()
    const { user } = useAuthStore()
    const { conversations, setConversations } = useChatStore()

    const [profile, setProfile] = useState<MomentProfile | null>(null)
    const [moments, setMoments] = useState<Moment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isOpeningChat, setIsOpeningChat] = useState(false)

    const targetUserId = String(userId || '')
    const isOwnProfile = String(user?.id || user?.userId || '') === targetUserId

    useEffect(() => {
        if (!targetUserId) return

        let mounted = true

        const loadProfile = async () => {
            setIsLoading(true)
            try {
                const data = await momentService.getUserProfile(targetUserId)
                if (!mounted) return
                setProfile(data)
                setMoments(
                    [...(data.moments || [])].sort(
                        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                )
            } catch (error: any) {
                if (!mounted) return
                addToast(error?.message || 'Không thể tải trang cá nhân', 'error', 5000)
                navigate(-1)
            } finally {
                if (mounted) {
                    setIsLoading(false)
                }
            }
        }

        void loadProfile()

        return () => {
            mounted = false
        }
    }, [targetUserId, addToast, navigate])

    const mediaStats = useMemo(() => {
        const allMedia = moments.flatMap((moment) => moment.mediaUrls || [])
        const videoCount = allMedia.filter((url) => isVideoUrl(url)).length
        return {
            images: allMedia.length - videoCount,
            videos: videoCount,
        }
    }, [moments])

    const coverImage = useMemo(() => {
        const firstImage = moments
            .flatMap((moment) => moment.mediaUrls || [])
            .find((url) => !isVideoUrl(url))
        return firstImage || profile?.user?.avartarUrl || null
    }, [moments, profile?.user?.avartarUrl])

    const handleReact = async (momentId: string, emoji: string) => {
        const previousMoments = moments
        setMoments((prev) =>
            prev.map((moment) =>
                moment.momentId === momentId ? applyMomentReactionLocally(moment, emoji) : moment
            )
        )

        try {
            await momentService.reactToMoment(momentId, emoji)
        } catch (error: any) {
            setMoments(previousMoments)
            addToast(error?.message || 'Không thể thả cảm xúc', 'error')
        }
    }

    const handleShare = async (momentId: string) => {
        try {
            await momentService.shareMoment(momentId)
            addToast('Đã chia sẻ khoảnh khắc', 'success')
        } catch (error: any) {
            addToast(error?.message || 'Không thể chia sẻ khoảnh khắc', 'error')
        }
    }

    const handleOpenChat = async () => {
        if (!targetUserId || !user || isOwnProfile) return

        try {
            setIsOpeningChat(true)

            const existingConversation = conversations.find(
                (conversation) =>
                    conversation.type === 'private' &&
                    conversation.participants.some((participant) => String(participant.userId) === targetUserId)
            )

            if (existingConversation?.id) {
                navigate(`/chat/${existingConversation.id}`)
                return
            }

            const latestConversations = await getConversation()
            setConversations(latestConversations)

            const refreshedConversation = latestConversations.find(
                (conversation: any) =>
                    conversation.type === 'private' &&
                    conversation.participants.some((participant: any) => String(participant.userId) === targetUserId)
            )

            if (refreshedConversation?.id) {
                navigate(`/chat/${refreshedConversation.id}`)
                return
            }

            addToast('Hãy bắt đầu cuộc trò chuyện từ danh sách chat hiện có.', 'info', 3000)
        } catch (error: any) {
            addToast(error?.message || 'Không thể mở cuộc trò chuyện', 'error')
        } finally {
            setIsOpeningChat(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-dark-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                    <p className="text-gray-500 dark:text-gray-400">Đang tải trang cá nhân...</p>
                </div>
            </div>
        )
    }

    if (!profile?.user) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-100">
            <div className="relative h-72 overflow-hidden bg-slate-300">
                {coverImage ? (
                    <img src={coverImage} alt={profile.user.userName} className="h-full w-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-black/30" />

                <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="rounded-full bg-black/20 p-2 text-white transition-colors hover:bg-black/35"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                </div>

                <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
                    <div className="mx-auto flex max-w-4xl items-end gap-4">
                        {profile.user.avartarUrl ? (
                            <img
                                src={profile.user.avartarUrl}
                                alt={profile.user.userName}
                                className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-xl"
                            />
                        ) : (
                            <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-white/20 text-4xl font-bold text-white shadow-xl">
                                {profile.user.userName.charAt(0).toUpperCase()}
                            </div>
                        )}

                        <div className="pb-2 text-white">
                            <h1 className="text-3xl font-bold">{profile.user.userName}</h1>
                            <p className="mt-1 text-sm text-white/85">
                                {moments.length} khoảnh khắc đã đăng
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 pb-10 pt-8">
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-dark-200">
                        <div className="flex items-center gap-3">
                            <ImageIcon className="h-6 w-6 text-sky-500" />
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Ảnh</p>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{mediaStats.images}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-dark-200">
                        <div className="flex items-center gap-3">
                            <Video className="h-6 w-6 text-emerald-500" />
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Video</p>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{mediaStats.videos}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-dark-200">
                        <div className="flex items-center gap-3">
                            <UserIcon className="h-6 w-6 text-primary-500" />
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Trạng thái</p>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {profile.user.status || 'Đang hoạt động'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {!isOwnProfile && (
                    <div className="mt-5 flex justify-end">
                        <button
                            onClick={handleOpenChat}
                            disabled={isOpeningChat}
                            className="inline-flex items-center gap-2 rounded-full bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isOpeningChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                            Nhắn tin
                        </button>
                    </div>
                )}

                <div className="mt-6 space-y-4">
                    {moments.length === 0 ? (
                        <div className="rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-dark-200">
                            <p className="text-base text-gray-500 dark:text-gray-400">
                                Chưa có bài đăng nào để hiển thị.
                            </p>
                        </div>
                    ) : (
                        moments.map((moment) => (
                            <MomentCard
                                key={moment.momentId}
                                moment={moment}
                                onReact={handleReact}
                                onDelete={async () => undefined}
                                onShare={handleShare}
                                onEdit={() => undefined}
                                onCommentCountChange={(momentId, delta) =>
                                    setMoments((prev) => updateMomentCommentCount(prev, momentId, delta))
                                }
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
