import { Server, Socket } from 'socket.io'
import { Message, Conversation } from '../modules/chat/chat.model.js'

export function chatSocketHandler(
    io: Server,
    socket: Socket,
    userSockets: Map<string, string>
) {
    const userId = socket.data.userId

    // Join conversation rooms
    socket.on('conversation:join', async (conversationIds: string[]) => {
        for (const id of conversationIds) {
            socket.join(`conversation:${id}`)
        }
    })

    // Send message
    socket.on('chat:send', async (data: {
        conversationId: string
        type: string
        content: any
        replyTo?: string
    }) => {
        try {
            // Create message in database
            const message = await Message.create({
                conversationId: data.conversationId,
                senderId: userId,
                type: data.type,
                content: data.content,
                replyTo: data.replyTo
            })

            // Update conversation's last message
            await Conversation.findByIdAndUpdate(data.conversationId, {
                lastMessage: {
                    content: data.content.text || '[Media]',
                    type: data.type,
                    senderId: userId,
                    timestamp: new Date()
                },
                updatedAt: new Date()
            })

            // Broadcast to conversation room
            io.to(`conversation:${data.conversationId}`).emit('chat:message', message)

        } catch (error) {
            console.error('Error sending message:', error)
            socket.emit('chat:error', { message: 'Failed to send message' })
        }
    })

    // Typing indicator
    socket.on('chat:typing', (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
            conversationId: data.conversationId,
            userId
        })
    })

    // Read receipt
    socket.on('chat:read', async (data: { conversationId: string, messageId: string }) => {
        try {
            await Message.findByIdAndUpdate(data.messageId, {
                $push: {
                    readBy: { userId, readAt: new Date() }
                }
            })

            socket.to(`conversation:${data.conversationId}`).emit('chat:read', {
                conversationId: data.conversationId,
                messageId: data.messageId,
                userId
            })
        } catch (error) {
            console.error('Error marking as read:', error)
        }
    })

    // Delete message
    socket.on('chat:delete', async (data: { conversationId: string, messageId: string }) => {
        try {
            await Message.findByIdAndUpdate(data.messageId, { isDeleted: true })

            io.to(`conversation:${data.conversationId}`).emit('chat:deleted', {
                conversationId: data.conversationId,
                messageId: data.messageId
            })
        } catch (error) {
            console.error('Error deleting message:', error)
        }
    })

    // Add reaction
    socket.on('chat:reaction', async (data: {
        conversationId: string,
        messageId: string,
        emoji: string
    }) => {
        try {
            await Message.findByIdAndUpdate(data.messageId, {
                $push: {
                    reactions: { userId, emoji: data.emoji }
                }
            })

            io.to(`conversation:${data.conversationId}`).emit('chat:reaction', {
                conversationId: data.conversationId,
                messageId: data.messageId,
                userId,
                emoji: data.emoji
            })
        } catch (error) {
            console.error('Error adding reaction:', error)
        }
    })
}
