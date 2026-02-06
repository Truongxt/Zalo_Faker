import { Server, Socket } from 'socket.io'
import { supabaseAdmin } from '../config/supabase.js'
import { Message, Conversation } from '../models/index.js'

// ==================== SOCKET.IO SETUP ====================
// Xử lý real-time events

// Lưu users đang online
const onlineUsers = new Map<string, string>() // userId -> socketId

export function setupSocket(io: Server) {

    // Middleware xác thực
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token

            if (!token) {
                return next(new Error('Vui lòng đăng nhập'))
            }

            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

            if (error || !user) {
                return next(new Error('Token không hợp lệ'))
            }

            // Gắn user vào socket
            ; (socket as any).user = {
                id: user.id,
                email: user.email,
                fullName: user.user_metadata?.full_name
            }

            next()
        } catch (err) {
            next(new Error('Lỗi xác thực'))
        }
    })

    io.on('connection', (socket: Socket) => {
        const user = (socket as any).user
        console.log(`✅ User connected: ${user.fullName} (${user.id})`)

        // Lưu user online
        onlineUsers.set(user.id, socket.id)

        // Thông báo online status
        socket.broadcast.emit('user:online', { userId: user.id })

        // Join vào các conversation rooms
        joinUserRooms(socket, user.id)

        // ==================== CHAT EVENTS ====================

        // Gửi tin nhắn
        socket.on('message:send', async (data) => {
            try {
                const { conversationId, type, content, replyTo } = data

                // Tạo message
                const message = await Message.create({
                    conversationId,
                    senderId: user.id,
                    type: type || 'text',
                    content,
                    replyTo
                })

                // Cập nhật conversation
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: {
                        content: content.text || `[${type}]`,
                        type,
                        senderId: user.id,
                        timestamp: new Date()
                    },
                    updatedAt: new Date()
                })

                // Broadcast đến tất cả members trong room
                io.to(`conversation:${conversationId}`).emit('message:new', {
                    message,
                    conversationId
                })

            } catch (error) {
                console.error('Send message error:', error)
                socket.emit('error', { message: 'Không thể gửi tin nhắn' })
            }
        })

        // Đang gõ
        socket.on('typing:start', (data) => {
            socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
                userId: user.id,
                fullName: user.fullName,
                conversationId: data.conversationId
            })
        })

        socket.on('typing:stop', (data) => {
            socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
                userId: user.id,
                conversationId: data.conversationId
            })
        })

        // Đánh dấu đã đọc
        socket.on('message:read', async (data) => {
            try {
                const { conversationId, messageId } = data

                // Cập nhật lastRead
                await Conversation.updateOne(
                    { _id: conversationId, 'participants.userId': user.id },
                    { $set: { 'participants.$.lastRead': new Date() } }
                )

                // Thông báo cho người gửi
                socket.to(`conversation:${conversationId}`).emit('message:read', {
                    conversationId,
                    messageId,
                    userId: user.id
                })

            } catch (error) {
                console.error('Read receipt error:', error)
            }
        })

        // Xóa tin nhắn
        socket.on('message:delete', async (data) => {
            try {
                const { conversationId, messageId } = data

                await Message.findOneAndUpdate(
                    { _id: messageId, senderId: user.id },
                    { isDeleted: true }
                )

                io.to(`conversation:${conversationId}`).emit('message:deleted', {
                    conversationId,
                    messageId
                })

            } catch (error) {
                console.error('Delete message error:', error)
            }
        })

        // Reaction
        socket.on('message:reaction', async (data) => {
            try {
                const { conversationId, messageId, emoji } = data

                // Remove old reaction, add new
                await Message.findByIdAndUpdate(messageId, {
                    $pull: { reactions: { userId: user.id } }
                })

                await Message.findByIdAndUpdate(messageId, {
                    $push: { reactions: { userId: user.id, emoji } }
                })

                io.to(`conversation:${conversationId}`).emit('message:reaction', {
                    conversationId,
                    messageId,
                    userId: user.id,
                    emoji
                })

            } catch (error) {
                console.error('Reaction error:', error)
            }
        })

        // ==================== DISCONNECT ====================
        socket.on('disconnect', () => {
            console.log(`❌ User disconnected: ${user.fullName}`)
            onlineUsers.delete(user.id)
            socket.broadcast.emit('user:offline', { userId: user.id })
        })
    })
}

// Join user vào tất cả conversation rooms
async function joinUserRooms(socket: Socket, userId: string) {
    try {
        const conversations = await Conversation.find({
            'participants.userId': userId
        }).select('_id')

        conversations.forEach(conv => {
            socket.join(`conversation:${conv._id}`)
        })

        console.log(`📍 Joined ${conversations.length} rooms`)
    } catch (error) {
        console.error('Join rooms error:', error)
    }
}

// Helper: Lấy socket ID của user
export function getSocketId(userId: string): string | undefined {
    return onlineUsers.get(userId)
}

// Helper: Kiểm tra user online
export function isUserOnline(userId: string): boolean {
    return onlineUsers.has(userId)
}
