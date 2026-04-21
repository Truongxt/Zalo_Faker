import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/authStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

class SocketService {
    private socket: Socket | null = null
    /** userId hiện tại — dùng lại khi socket reconnect */
    private currentUserId: string | null = null
    /** Phòng đã join — reconnect sẽ join lại toàn bộ */
    private joinedRooms = new Set<string>()
    private listeners = new Map<string, Set<Function>>()

    connect(userId: string) {
        this.currentUserId = userId
        const latestToken = useAuthStore.getState().accessToken

        const refreshPresenceAndRooms = () => {
            if (!this.socket) return
            console.log('✅ Socket connected:', this.socket.id)
            if (this.joinedRooms.size > 0) {
                console.log('🏘️ Re-joining rooms:', Array.from(this.joinedRooms))
                this.joinedRooms.forEach((conversationId) => {
                    this.socket?.emit('room:join', conversationId)
                })
            }
        }


        if (!this.socket) {
            this.socket = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                auth: {
                    token: latestToken,
                    platform: 'web'
                }
            })

            // Apply persistent listeners
            this.listeners.forEach((callbacks, event) => {
                callbacks.forEach((cb) => {
                    this.socket?.on(event, cb as any)
                })
            })

            this.socket.on('connect', refreshPresenceAndRooms)
            this.socket.on('reconnect', refreshPresenceAndRooms)

            this.socket.on('disconnect', (reason) => {
                console.log('❌ Socket disconnected:', reason)
            })

            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error.message)
                // Ensure reconnect always uses latest access token
                if (this.socket) {
                    this.socket.auth = { token: useAuthStore.getState().accessToken, platform: 'web' }
                }
            })
        } else {
            // Keep auth token fresh for existing socket instance
            this.socket.auth = { token: latestToken, platform: 'web' }
            if (this.socket.connected) {
                refreshPresenceAndRooms()
            } else {
                this.socket.connect()
            }
        }

        return this.socket
    }

    disconnect() {
        if (this.socket) {
            this.joinedRooms.clear()
            this.currentUserId = null
            this.socket.disconnect()
            this.socket = null
        }
    }

    // Vào phòng chat
    joinRoom(conversationId: string) {
        this.joinedRooms.add(conversationId)
        this.socket?.emit('room:join', conversationId)
    }

    // Rời phòng chat
    leaveRoom(conversationId: string) {
        this.joinedRooms.delete(conversationId)
        this.socket?.emit('room:leave', conversationId)
    }

    // Vào nhiều phòng chat cùng lúc
    joinRooms(conversationIds: string[]) {
        conversationIds.forEach(id => {
            if (!this.joinedRooms.has(id)) {
                this.joinedRooms.add(id)
                this.socket?.emit('room:join', id)
            }
        })
    }

    // Gửi tin nhắn
    sendMessage(data: {
        conversationId: string
        senderId?: string
        type: string
        content: { text?: string; mediaUrl?: string; fileName?: string; fileSize?: number; duration?: number }
        metadata?: { isAnnouncement?: boolean; isImportant?: boolean }
        replyTo?: string
        clientTempId?: string
    }, callback?: (res: { success: boolean; message?: any; error?: string }) => void) {
        if (!this.socket?.connected && this.currentUserId) {
            this.connect(this.currentUserId)
        }
        this.socket?.emit('chat:send', data, callback)
    }

    // Typing
    sendTyping(conversationId: string, _userId?: string) {
        this.socket?.emit('chat:typing', { conversationId })
    }

    stopTyping(conversationId: string, _userId?: string) {
        this.socket?.emit('chat:stop_typing', { conversationId })
    }

    // Đã đọc
    markAsRead(conversationId: string, messageId: string, _userId?: string) {
        this.socket?.emit('chat:read', { conversationId, messageId })
    }

    // Lắng nghe event
    on(event: string, callback: (...args: any[]) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set())
        }
        this.listeners.get(event)?.add(callback)
        this.socket?.on(event, callback)
    }

    off(event: string, callback?: (...args: any[]) => void) {
        if (callback) {
            this.listeners.get(event)?.delete(callback)
            this.socket?.off(event, callback)
        } else {
            this.listeners.delete(event)
            this.socket?.off(event)
        }
    }

    isConnected() {
        return this.socket?.connected ?? false
    }

    getSocket() {
        return this.socket
    }

    recallMessage(
        data: { messageId: string; conversationId: string; senderId?: string },
        callback?: (res: { success: boolean; error?: string }) => void
    ) {
        this.socket?.emit('chat:recall', data, callback)
    }

    reactToMessage(
        data: { messageId: string; conversationId: string; userId?: string; emoji: string },
        callback?: (res: { success: boolean; error?: string }) => void
    ) {
        this.socket?.emit('chat:reaction', data, callback)
    }
}

export const socketService = new SocketService()
export default socketService
