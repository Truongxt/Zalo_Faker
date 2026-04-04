import { useEffect, useState, useCallback } from 'react'
import { offlineMessagesDB, PendingMessage } from '@/services/offlineMessagesDB'
import { socketService } from '@/lib/socket'
import { useToast } from '@/contexts/ToastContext'

export interface OfflineQueueStatus {
    isOnline: boolean
    pendingCount: number
    failedCount: number
    isSyncing: boolean
}

/**
 * Hook to manage offline message queue
 * Handles storing messages offline, detecting connection changes, and syncing
 */
export function useOfflineQueue() {
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [status, setStatus] = useState<OfflineQueueStatus>({
        isOnline: true,
        pendingCount: 0,
        failedCount: 0,
        isSyncing: false,
    })
    const { addToast } = useToast()

    // Update stats
    const updateStats = useCallback(async () => {
        const stats = await offlineMessagesDB.getStats()
        setStatus(prev => ({
            ...prev,
            pendingCount: stats.pending,
            failedCount: stats.failed,
        }))
    }, [])

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            setStatus(prev => ({ ...prev, isOnline: true }))
            addToast('Bạn đã quay lại online', 'info', 2000)
        }

        const handleOffline = () => {
            setIsOnline(false)
            setStatus(prev => ({ ...prev, isOnline: false }))
            addToast('Bạn đang offline. Tin nhắn sẽ được gửi khi có kết nối.', 'warning', 3000)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [addToast])

    // Sync pending messages when coming online
    useEffect(() => {
        if (!isOnline || isSyncing) return

        const syncMessages = async () => {
            setIsSyncing(true)
            setStatus(prev => ({ ...prev, isSyncing: true }))

            try {
                const allPending = await offlineMessagesDB.getAllPending()

                if (allPending.length === 0) {
                    setIsSyncing(false)
                    setStatus(prev => ({ ...prev, isSyncing: false }))
                    return
                }

                let successCount = 0
                let failCount = 0

                for (const message of allPending) {
                    try {
                        // Attempt to send via socket
                        await new Promise<void>((resolve, reject) => {
                            socketService.sendMessage({
                                conversationId: message.conversationId,
                                senderId: message.senderId,
                                type: message.type,
                                content: message.content,
                                metadata: message.metadata,
                                replyTo: message.replyTo,
                            }, (res) => {
                                if (res.success) {
                                    resolve()
                                } else {
                                    reject(new Error(res.error || 'Send failed'))
                                }
                            })

                            // Timeout after 10 seconds
                            setTimeout(() => reject(new Error('Send timeout')), 10000)
                        })

                        // Mark as sent
                        await offlineMessagesDB.updateMessage(message.id, {
                            status: 'sent',
                        })

                        successCount++
                    } catch (error) {
                        failCount++
                        const retryCount = (message.retryCount || 0) + 1
                        const maxRetries = 3

                        if (retryCount >= maxRetries) {
                            // Mark as failed if exceeded max retries
                            await offlineMessagesDB.updateMessage(message.id, {
                                status: 'failed',
                                retryCount,
                                error: error instanceof Error ? error.message : 'Unknown error',
                                lastRetryAt: new Date().toISOString(),
                            })
                        } else {
                            // Keep as pending for retry
                            await offlineMessagesDB.updateMessage(message.id, {
                                retryCount,
                                lastRetryAt: new Date().toISOString(),
                            })
                        }

                        console.error(`Failed to sync message ${message.id}:`, error)
                    }
                }

                // Show summary toast
                if (successCount > 0) {
                    addToast(`Đã gửi ${successCount} tin nhắn`, 'success', 2000)
                }

                if (failCount > 0) {
                    addToast(`Không thể gửi ${failCount} tin nhắn`, 'error', 3000)
                }

                await updateStats()
            } catch (error) {
                console.error('Sync failed:', error)
                addToast('Lỗi khi đồng bộ tin nhắn', 'error', 3000)
            } finally {
                setIsSyncing(false)
                setStatus(prev => ({ ...prev, isSyncing: false }))
            }
        }

        // Small delay to ensure socket is ready
        const timer = setTimeout(syncMessages, 500)
        return () => clearTimeout(timer)
    }, [isOnline, isSyncing, addToast, updateStats])

    // Initial stats load
    useEffect(() => {
        updateStats()
    }, [updateStats])

    // Store message for offline queue
    const storeOfflineMessage = useCallback(
        async (
            conversationId: string,
            senderId: string,
            type: string,
            content: any,
            metadata?: { isAnnouncement?: boolean },
            replyTo?: string
        ) => {
            const message: PendingMessage = {
                id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                conversationId,
                senderId,
                type: type as any,
                content,
                metadata,
                replyTo,
                status: 'pending',
                retryCount: 0,
                createdAt: new Date().toISOString(),
            }

            try {
                await offlineMessagesDB.addMessage(message)
                await updateStats()
                return message
            } catch (error) {
                console.error('Failed to store offline message:', error)
                throw error
            }
        },
        [updateStats]
    )

    // Remove message from queue (after successful send)
    const removeFromQueue = useCallback(async (messageId: string) => {
        try {
            await offlineMessagesDB.removeMessage(messageId)
            await updateStats()
        } catch (error) {
            console.error('Failed to remove message from queue:', error)
        }
    }, [updateStats])

    // Retry failed messages
    const retryFailed = useCallback(async () => {
        setIsOnline(true)
        setStatus(prev => ({ ...prev, isOnline: true }))
        // Manually trigger sync by resetting isSyncing
        setIsSyncing(false)
    }, [])

    return {
        isOnline,
        isSyncing,
        status,
        storeOfflineMessage,
        removeFromQueue,
        retryFailed,
        updateStats,
    }
}
