import { Message } from '@/stores/chatStore'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Check, CheckCheck, MoreHorizontal, Reply, SmilePlus } from 'lucide-react'

interface MessageBubbleProps {
    message: Message
    isSent: boolean
    showAvatar?: boolean
    onReply?: () => void
}

export default function MessageBubble({
    message,
    isSent,
    showAvatar = false,
    onReply
}: MessageBubbleProps) {
    const renderContent = () => {
        switch (message.type) {
            case 'image':
                return (
                    <div className="relative group">
                        <img
                            src={message.content.mediaUrl}
                            alt="Image"
                            className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                        />
                        {message.content.text && (
                            <p className="mt-2">{message.content.text}</p>
                        )}
                    </div>
                )

            case 'video':
                return (
                    <div className="relative group">
                        <video
                            src={message.content.mediaUrl}
                            poster={message.content.thumbnail}
                            controls
                            className="max-w-[300px] rounded-lg"
                        />
                        {message.content.text && (
                            <p className="mt-2">{message.content.text}</p>
                        )}
                    </div>
                )

            case 'file':
                return (
                    <a
                        href={message.content.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-black/10 dark:bg-white/10 rounded-lg hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                    >
                        <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                            {message.content.fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{message.content.fileName}</p>
                            <p className="text-sm opacity-70">
                                {message.content.fileSize ? `${(message.content.fileSize / 1024).toFixed(1)} KB` : ''}
                            </p>
                        </div>
                    </a>
                )

            case 'sticker':
                return (
                    <img
                        src={message.content.mediaUrl}
                        alt="Sticker"
                        className="w-32 h-32 object-contain"
                    />
                )

            case 'voice':
                return (
                    <div className="flex items-center gap-3 min-w-[200px]">
                        <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            ▶
                        </button>
                        <div className="flex-1">
                            <div className="h-1 bg-white/30 rounded-full">
                                <div className="h-full w-0 bg-white rounded-full" />
                            </div>
                            <span className="text-xs opacity-70 mt-1">
                                {message.content.duration ? `${Math.floor(message.content.duration / 60)}:${String(message.content.duration % 60).padStart(2, '0')}` : '0:00'}
                            </span>
                        </div>
                    </div>
                )

            default:
                return <p className="whitespace-pre-wrap">{message.content.text}</p>
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
        <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} group`}>
            <div className={`flex items-end gap-2 max-w-[70%] ${isSent ? 'flex-row-reverse' : ''}`}>
                {/* Avatar for received messages */}
                {!isSent && showAvatar && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                )}
                {!isSent && !showAvatar && <div className="w-8" />}

                <div className={`relative ${isSent ? 'items-end' : 'items-start'}`}>
                    {/* Message bubble */}
                    <div className={`message-bubble ${isSent ? 'message-sent' : 'message-received'}`}>
                        {renderContent()}
                    </div>

                    {/* Reactions */}
                    {message.reactions.length > 0 && (
                        <div className={`flex gap-0.5 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                            {[...new Set(message.reactions.map(r => r.emoji))].slice(0, 3).map((emoji, i) => (
                                <span key={i} className="text-sm">{emoji}</span>
                            ))}
                            {message.reactions.length > 1 && (
                                <span className="text-xs text-gray-500 ml-1">{message.reactions.length}</span>
                            )}
                        </div>
                    )}

                    {/* Time and status */}
                    <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: false, locale: vi })}
                        </span>
                        {isSent && (
                            message.readBy.length > 0 ? (
                                <CheckCheck className="w-3 h-3 text-primary-500" />
                            ) : (
                                <Check className="w-3 h-3 text-gray-400" />
                            )
                        )}
                    </div>
                </div>

                {/* Actions (shown on hover) */}
                <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${isSent ? 'flex-row-reverse' : ''}`}>
                    <button
                        onClick={onReply}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                    >
                        <Reply className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                        <SmilePlus className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                        <MoreHorizontal className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            </div>
        </div>
    )
}
