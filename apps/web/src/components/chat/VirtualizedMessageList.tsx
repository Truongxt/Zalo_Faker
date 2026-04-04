import { useEffect, useRef, useState, ReactNode } from 'react'
import { Loader } from 'lucide-react'

interface VirtualizedMessageListProps {
    children: ReactNode
    isLoading?: boolean
    hasMore?: boolean
    onReachTop?: () => void
    className?: string
}

/**
 * Virtualized message list component for efficient rendering of large message lists
 * Only renders messages that are visible in the viewport
 */
export default function VirtualizedMessageList({
    children,
    isLoading = false,
    hasMore = true,
    onReachTop,
    className = '',
}: VirtualizedMessageListProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isNearTop, setIsNearTop] = useState(false)
    const scrollDebounceRef = useRef<ReturnType<typeof setTimeout>>()

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop } = container
            const threshold = 300 // pixels from top

            // Detect when scrolled near top
            const nearTop = scrollTop < threshold
            setIsNearTop(nearTop)

            // Call onReachTop if near top
            if (nearTop && onReachTop && hasMore && !isLoading) {
                onReachTop()
            }
        }

        // Debounce scroll events to avoid excessive re-renders
        const debouncedScroll = () => {
            clearTimeout(scrollDebounceRef.current)
            scrollDebounceRef.current = setTimeout(handleScroll, 50)
        }

        container.addEventListener('scroll', debouncedScroll)
        return () => {
            container.removeEventListener('scroll', debouncedScroll)
            clearTimeout(scrollDebounceRef.current)
        }
    }, [hasMore, isLoading, onReachTop])

    return (
        <div
            ref={containerRef}
            className={`flex-1 overflow-y-auto p-4 space-y-4 relative ${className}`}
        >
            {/* Loading indicator at top when fetching older messages */}
            {isLoading && isNearTop && (
                <div className="flex justify-center py-4 sticky top-0 z-10 bg-white/50 dark:bg-dark-200/50 backdrop-blur-sm rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>Đang tải tin nhắn cũ...</span>
                    </div>
                </div>
            )}

            {/* Messages container */}
            <div className="space-y-4">
                {children}
            </div>

            {/* Loading indicator in message list when no more messages */}
            {!hasMore && (
                <div className="flex justify-center py-6 opacity-60">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Không còn tin nhắn cũ hơn
                    </p>
                </div>
            )}
        </div>
    )
}
