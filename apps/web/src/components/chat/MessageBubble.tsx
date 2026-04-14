import { useState, useRef, useEffect } from 'react'
import { Message } from '@/stores/chatStore'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Check, CheckCheck, Reply, SmilePlus, Trash2, Share, Pin, Star } from 'lucide-react'
import VoicePlayer from './VoicePlayer'

interface MessageBubbleProps {
    message: Message
    isSent: boolean
    showAvatar?: boolean
    senderUserId?: string
    senderName?: string
    senderAvatar?: string
    replyMessage?: Message | null
    replySenderName?: string
    onReply?: () => void
    onRecall?: () => void
    onReact?: (emoji: string) => void
    onForward?: () => void
    onPin?: () => void
    canPin?: boolean
    participants?: Array<{ userId: string; fullName?: string }>
    isGroupChat?: boolean
    onAvatarClick?: () => void
    searchQuery?: string
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡']

const normalizeContent = (rawContent: any) => {
    if (typeof rawContent === 'string') {
        return { text: rawContent }
    }

    if (!rawContent || typeof rawContent !== 'object') {
        return {}
    }

    return {
        text: typeof rawContent.text === 'string'
            ? rawContent.text
            : typeof rawContent.message === 'string'
                ? rawContent.message
                : typeof rawContent.content === 'string'
                    ? rawContent.content
                    : undefined,
        mediaUrl: typeof rawContent.mediaUrl === 'string'
            ? rawContent.mediaUrl
            : typeof rawContent.url === 'string'
                ? rawContent.url
                : typeof rawContent.fileUrl === 'string'
                    ? rawContent.fileUrl
                    : undefined,
        thumbnail: typeof rawContent.thumbnail === 'string' ? rawContent.thumbnail : undefined,
        fileName: typeof rawContent.fileName === 'string' ? rawContent.fileName : undefined,
        fileSize: typeof rawContent.fileSize === 'number' ? rawContent.fileSize : undefined,
        duration: typeof rawContent.duration === 'number' ? rawContent.duration : undefined,
    }
}
export default function MessageBubble({
    message,
    isSent,
    showAvatar = false,
    senderUserId,
    senderName,
    senderAvatar,
    replyMessage,
    replySenderName,
    onReply,
    onRecall,
    onReact,
    onForward,
    onPin,
    canPin = false,
    participants = [],
    isGroupChat = false,
    onAvatarClick,
    searchQuery = '',
}: MessageBubbleProps) {
    const [showReactionPicker, setShowReactionPicker] = useState(false)
    const [showConfirmRecall, setShowConfirmRecall] = useState(false)
    const reactionRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLDivElement>(null)
    const isAnnouncement = Boolean(message.metadata?.isAnnouncement)
    const isImportant = Boolean(message.metadata?.isImportant)
    const reactions = Array.isArray(message.reactions) ? message.reactions : []
    const readBy = Array.isArray(message.readBy) ? message.readBy : []
    const content = normalizeContent(message.content)
    const highlightedBubbleClass = isImportant
        ? 'border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 text-gray-900 ring-2 ring-amber-200/80 shadow-lg shadow-amber-100/80 dark:border-amber-700 dark:bg-gradient-to-br dark:from-amber-950/40 dark:via-dark-200 dark:to-orange-950/30 dark:text-white dark:ring-amber-800/70 dark:shadow-none'
        : isAnnouncement
            ? 'border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-900/20 text-gray-900 dark:text-amber-50'
            : ''
    const normalizedSearchQuery = searchQuery.trim()

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const renderHighlightedText = (text?: string, className?: string) => {
        const value = text || ''
        if (!normalizedSearchQuery) {
            return <p className={className}>{value}</p>
        }

        const parts = value.split(new RegExp(`(${escapeRegExp(normalizedSearchQuery)})`, 'gi'))

        return (
            <p className={className}>
                {parts.map((part, index) => (
                    part.toLowerCase() === normalizedSearchQuery.toLowerCase()
                        ? (
                            <mark
                                key={`${part}-${index}`}
                                className="rounded bg-amber-200/90 px-0.5 text-inherit dark:bg-amber-500/30"
                            >
                                {part}
                            </mark>
                        )
                        : <span key={`${part}-${index}`}>{part}</span>
                ))}
            </p>
        )
    }

    // Format read receipt info for tooltip
    const getReadReceiptInfo = () => {
        if (!isSent || readBy.length === 0) return ''

        const readUsers = readBy
            .map(r => {
                const participant = participants.find(p => p.userId === r.userId)
                return {
                    name: participant?.fullName || 'Người dùng',
                    time: new Date(r.readAt)
                }
            })
            .sort((a, b) => b.time.getTime() - a.time.getTime())

        if (readUsers.length === 0) return ''

        let tooltip = '✓ '
        if (isGroupChat && participants.length > 0) {
            // For group chats show count
            if (readUsers.length === participants.length) {
                tooltip += `Tất cả đã đọc`
            } else {
                tooltip += `${readUsers.length}/${participants.length} người đã đọc`
            }
        } else {
            // For private chats show person name
            tooltip += `${readUsers[0].name} đã đọc`
        }

        // Add times for first few people
        tooltip += '\n' + readUsers
            .slice(0, 3)
            .map(u => {
                const timeStr = u.time.toLocaleTimeString('vi-VN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                return `${u.name} · ${timeStr}`
            })
            .join('\n')

        if (readUsers.length > 3) {
            tooltip += `\n...và ${readUsers.length - 3} người khác`
        }

        return tooltip
    }

    // Click outside → đóng reaction picker
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) {
                setShowReactionPicker(false)
            }
            if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
                setShowConfirmRecall(false)
            }
        }
        if (showReactionPicker || showConfirmRecall) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showReactionPicker, showConfirmRecall])

    const renderContent = () => {
        switch (message.type) {
            case 'image':
                return (
                    <div className="relative group">
                        <img
                            src={content.mediaUrl}
                            alt="Image"
                            className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                        />
                        {content.text && (
                            renderHighlightedText(content.text, 'mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]')
                        )}
                    </div>
                )

            case 'video':
                return (
                    <div className="relative group">
                        <video
                            src={String(content.mediaUrl || '') + (String(content.mediaUrl || '').includes('#t=') ? '' : '#t=0.001')}
                            poster={content.thumbnail}
                            controls
                            className="max-w-[300px] rounded-lg"
                        />
                        {content.text && (
                            renderHighlightedText(content.text, 'mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]')
                        )}
                    </div>
                )

            case 'file':
                return (
                    <div className="flex flex-col gap-2">
                        {content.text && (
                            renderHighlightedText(content.text, 'whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]')
                        )}
                        <a
                            href={content.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-black/10 dark:bg-white/10 rounded-lg hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                        >
                            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                                {content.fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
                            </div>
                            <div className="flex-1 min-w-0">
                                {renderHighlightedText(content.fileName, 'font-medium truncate')}
                                <p className="text-sm opacity-70">
                                    {content.fileSize ? `${(content.fileSize / 1024).toFixed(1)} KB` : ''}
                                </p>
                            </div>
                        </a>
                    </div>
                )

            case 'sticker':
                return (
                    <img
                        src={content.mediaUrl}
                        alt="Sticker"
                        className="w-32 h-32 object-contain"
                    />
                )

            case 'voice':
                return (
                    <div className="flex flex-col gap-1">
                        <VoicePlayer
                            src={content.mediaUrl || ''}
                            duration={content.duration}
                        />
                    </div>
                )

            default:
                return renderHighlightedText(content.text, 'whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]')
        }
    }

    if (message.isDeleted) {
        return (
            <div className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                <div className="message-bubble bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic">
                    Tin nhắn đã bị xóa
                </div>
            </div>
        )
    }

    return (
        <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} group mb-4`}>
            <div className={`flex items-end gap-2 max-w-[75%] ${isSent ? 'flex-row-reverse' : ''}`}>
                {/* Avatar for received messages */}
                {!isSent && showAvatar && (
                    <button
                        type="button"
                        onClick={onAvatarClick}
                        disabled={!onAvatarClick}
                        className={`${onAvatarClick ? 'cursor-pointer' : 'cursor-default'} flex-shrink-0`}
                        title={onAvatarClick ? `Xem trang cá nhân của ${senderName || 'người dùng'}` : undefined}
                    >
                        {senderAvatar ? (
                            <img
                                src={senderAvatar}
                                alt={senderName || senderUserId || ''}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                                    {(senderName || '?').charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </button>
                )}
                {!isSent && !showAvatar && <div className="w-8" />}

                <div className={`flex flex-col relative ${isSent ? 'items-end' : 'items-start'} max-w-full`}>
                    {/* Reply reference */}
                    {replyMessage && (
                        <div className={`mb-1 px-3 py-1.5 rounded-lg text-xs bg-black/5 dark:bg-white/5 border-l-2 border-primary-500 ${isSent ? 'ml-auto' : 'mr-auto'} max-w-full`}>
                            <p className="font-medium text-primary-500 truncate">
                                {replySenderName || 'Người dùng'}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 truncate">
                                {replyMessage.isDeleted ? 'Tin nhắn đã bị xóa' : (replyMessage.content?.text || '[Media]')}
                            </p>
                        </div>
                    )}

                    {/* Message bubble */}
                    <div
                        className={`message-bubble ${isSent ? 'message-sent' : 'message-received'} ${highlightedBubbleClass}`}
                    >
                        {isAnnouncement && (
                            <div className="mb-1.5 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                Thông báo
                            </div>
                        )}
                        {isImportant && (
                            <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                <Star className="h-3 w-3 fill-current" />
                                Quan trọng
                            </div>
                        )}
                        {renderContent()}
                    </div>

                    {/* Reactions display */}
                    {reactions.length > 0 && (
                        <div className={`flex gap-0.5 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
                            <div className="flex items-center gap-0.5 bg-white dark:bg-dark-300 rounded-full px-1.5 py-0.5 shadow-sm border border-gray-100 dark:border-gray-700">
                                {[...new Set(reactions.map(r => r.emoji))].slice(0, 3).map((emoji, i) => (
                                    <span key={i} className="text-sm">{emoji}</span>
                                ))}
                                {reactions.length > 1 && (
                                    <span className="text-xs text-gray-500 ml-0.5">{reactions.length}</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Time and status */}
                    <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: false, locale: vi })}
                        </span>
                        {isSent && (
                            <div className="group/receipt relative" title={readBy.length > 0 ? getReadReceiptInfo() : 'Đã gửi'}>
                                {readBy.length > 0 ? (
                                    <>
                                        <CheckCheck
                                            className="w-3 h-3 text-primary-500 cursor-help"
                                        />
                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover/receipt:block z-50">
                                            <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                                {isGroupChat && participants.length > 0 ? (
                                                    readBy.length === participants.length ? (
                                                        <span>
                                                            {readBy.length === 1
                                                                ? `1 người đã đọc`
                                                                : `Tất cả ${readBy.length} người đã đọc`
                                                            }
                                                        </span>
                                                    ) : (
                                                        <span>
                                                            {readBy.length}/{participants.length} người đã đọc
                                                        </span>
                                                    )
                                                ) : (
                                                    <span>Đã được đọc</span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <Check
                                        className="w-3 h-3 text-gray-400"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions (shown on hover) */}
                <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isSent ? 'flex-row-reverse' : ''}`}>
                    <button
                        onClick={onReply}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                        title="Trả lời"
                    >
                        <Reply className="w-4 h-4 text-gray-500" />
                    </button>

                    {!message.isDeleted && (
                        <button
                            onClick={onForward}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                            title="Chuyển tiếp"
                        >
                            <Share className="w-4 h-4 text-gray-500" />
                        </button>
                    )}

                    {!message.isDeleted && canPin && (
                        <button
                            onClick={onPin}
                            className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-full transition-colors"
                            title="Ghim tin nhắn"
                        >
                            <Pin className="w-4 h-4 text-yellow-500" />
                        </button>
                    )}

                    {/* Reaction button with mini picker */}
                    <div className="relative" ref={reactionRef}>
                        <button
                            onClick={() => setShowReactionPicker(!showReactionPicker)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                            title="Thả cảm xúc"
                        >
                            <SmilePlus className="w-4 h-4 text-gray-500" />
                        </button>

                        {/* Quick reaction picker */}
                        {showReactionPicker && (
                            <div className={`absolute bottom-full mb-1 z-50 ${isSent ? 'right-0' : 'left-0'}`}>
                                <div className="flex items-center gap-1 bg-white dark:bg-dark-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 animate-scale-in">
                                    {QUICK_REACTIONS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            onClick={() => {
                                                onReact?.(emoji)
                                                setShowReactionPicker(false)
                                            }}
                                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-transform hover:scale-125 text-lg"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Recall button — chỉ hiện với tin nhắn của mình */}
                    {isSent && !message.isDeleted && (
                        <div className="relative" ref={confirmRef}>
                            <button
                                onClick={() => setShowConfirmRecall(true)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                title="Thu hồi tin nhắn"
                            >
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </button>

                            {/* Confirm recall dialog */}
                            {showConfirmRecall && (
                                <div className={`absolute bottom-full mb-1 z-50 ${isSent ? 'right-0' : 'left-0'}`}>
                                    <div className="bg-white dark:bg-dark-300 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[200px] animate-scale-in">
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                                            Thu hồi tin nhắn này?
                                        </p>
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => setShowConfirmRecall(false)}
                                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                                Hủy
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onRecall?.()
                                                    setShowConfirmRecall(false)
                                                }}
                                                className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                                            >
                                                Thu hồi
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

