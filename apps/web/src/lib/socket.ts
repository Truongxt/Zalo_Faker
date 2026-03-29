import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

class SocketService {
    private socket: Socket | null = null

    connect(userId: string) {
        // Nếu đã kết nối rồi thì thôi
        if (this.socket?.connected) return this.socket

        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        })

        this.socket.on('connect', () => {
            console.log('✅ Socket connected:', this.socket?.id)
            // Thông báo user online
            this.socket?.emit('user:join', userId)
        })

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason)
        })

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message)
        })

        return this.socket
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }
    }

    // Vào phòng chat
    joinRoom(conversationId: string) {
        this.socket?.emit('room:join', conversationId)
    }

    // Rời phòng chat
    leaveRoom(conversationId: string) {
        this.socket?.emit('room:leave', conversationId)
    }

    // Gửi tin nhắn
    sendMessage(data: {
        conversationId: string
        senderId: string
        type: string
        content: { text?: string; mediaUrl?: string; fileName?: string; fileSize?: number }
        replyTo?: string
    }, callback?: (res: { success: boolean; message?: any; error?: string }) => void) {
        this.socket?.emit('chat:send', data, callback)
    }

    // Typing
    sendTyping(conversationId: string, userId: string) {
        this.socket?.emit('chat:typing', { conversationId, userId })
    }

    stopTyping(conversationId: string, userId: string) {
        this.socket?.emit('chat:stop_typing', { conversationId, userId })
    }

    // Đã đọc
    markAsRead(conversationId: string, messageId: string, userId: string) {
        this.socket?.emit('chat:read', { conversationId, messageId, userId })
    }

    // Lắng nghe event
    on(event: string, callback: (...args: any[]) => void) {
        this.socket?.on(event, callback)
    }

    off(event: string, callback?: (...args: any[]) => void) {
        this.socket?.off(event, callback)
    }

    isConnected() {
        return this.socket?.connected ?? false
    }

    getSocket() {
        return this.socket
    }

    recallMessage(
        data: { messageId: string; conversationId: string; senderId: string },
        callback?: (res: { success: boolean; error?: string }) => void
    ) {
        this.socket?.emit('chat:recall', data, callback)
    }

    reactToMessage(
        data: { messageId: string; conversationId: string; userId: string; emoji: string },
        callback?: (res: { success: boolean; error?: string }) => void
    ) {
        this.socket?.emit('chat:reaction', data, callback)
    }
}

export const socketService = new SocketService()
export default socketService