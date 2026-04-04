import { useState, useEffect, useCallback, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { getMessages } from '@/services/api'

export interface PaginationState {
    page: number
    pageSize: number
    totalMessages: number
    isLoading: boolean
    hasMore: boolean
}

/**
 * Hook to manage message pagination
 * Implements infinite scroll by detecting scroll position and loading older messages
 */
export function useMessagePagination(conversationId: string | undefined) {
    const [paginationState, setPaginationState] = useState<PaginationState>({
        page: 1,
        pageSize: 50, // Load 50 messages per page
        totalMessages: 0,
        isLoading: false,
        hasMore: true,
    })

    const messages = useChatStore(
        state => state.messages[conversationId || ''] || []
    )
    const { setMessages } = useChatStore()
    const loadingRef = useRef(false)

    // Load initial messages
    useEffect(() => {
        if (!conversationId) return

        const msgs = useChatStore.getState().messages[conversationId] || []
        if (msgs.length === 0) {
            loadMessages(conversationId, 1)
        }
    }, [conversationId])

    // Load messages from API
    const loadMessages = useCallback(
        async (convId: string, page: number) => {
            if (loadingRef.current) return

            loadingRef.current = true
            setPaginationState(prev => ({ ...prev, isLoading: true }))

            try {
                const data = await getMessages(convId)

                // Sort messages by timestamp (oldest first)
                const sortedMessages = data.sort((a: any, b: any) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                )

                setMessages(convId, sortedMessages)

                setPaginationState(prev => ({
                    ...prev,
                    page,
                    totalMessages: sortedMessages.length,
                    hasMore: sortedMessages.length >= prev.pageSize,
                    isLoading: false,
                }))
            } catch (error) {
                console.error('Failed to load messages:', error)
                setPaginationState(prev => ({ ...prev, isLoading: false }))
            } finally {
                loadingRef.current = false
            }
        },
        [setMessages]
    )

    // Load more messages (when scrolling to top)
    const loadMore = useCallback(() => {
        if (!conversationId || !paginationState.hasMore || loadingRef.current) return
        loadMessages(conversationId, paginationState.page + 1)
    }, [conversationId, paginationState.page, paginationState.hasMore, loadMessages])

    return {
        ...paginationState,
        loadMore,
        messageCount: messages.length,
    }
}

/**
 * Hook to handle scroll-to-top detection for infinite scroll
 */
export function useScrollToTop(onReachTop: () => void, threshold: number = 100) {
    const containerRef = useRef<HTMLDivElement>(null)
    const lastScrollRef = useRef(0)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop } = container

            // Detect scroll to top with threshold
            if (scrollTop < threshold && scrollTop < lastScrollRef.current) {
                onReachTop()
            }

            lastScrollRef.current = scrollTop
        }

        // Debounce scroll event
        let timeoutId: ReturnType<typeof setTimeout>
        const debouncedScroll = () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(handleScroll, 50)
        }

        container.addEventListener('scroll', debouncedScroll)
        return () => {
            container.removeEventListener('scroll', debouncedScroll)
            clearTimeout(timeoutId)
        }
    }, [onReachTop, threshold])

    return containerRef
}
