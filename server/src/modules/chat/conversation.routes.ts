import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../../middleware/auth.js'
import { Conversation, Message } from './chat.model.js'

const router = Router()

// Get all conversations for current user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id

        const conversations = await Conversation.find({
            'participants.userId': userId
        }).sort({ updatedAt: -1 })

        // Calculate unread count for each conversation
        const result = await Promise.all(
            conversations.map(async (conv) => {
                const participant = conv.participants.find(p => p.userId === userId)
                const lastRead = participant?.lastRead

                let unreadCount = 0
                if (lastRead) {
                    unreadCount = await Message.countDocuments({
                        conversationId: conv._id,
                        senderId: { $ne: userId },
                        createdAt: { $gt: lastRead },
                        isDeleted: false
                    })
                }

                return {
                    id: conv._id,
                    type: conv.type,
                    name: conv.name,
                    avatar: conv.avatar,
                    participants: conv.participants,
                    lastMessage: conv.lastMessage,
                    unreadCount,
                    createdAt: conv.createdAt,
                    updatedAt: conv.updatedAt
                }
            })
        )

        res.json(result)
    } catch (error) {
        console.error('Error fetching conversations:', error)
        res.status(500).json({ message: 'Failed to fetch conversations' })
    }
})

// Create a new conversation
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { participantIds, type, name } = req.body

        // For private chat, check if conversation exists
        if (type === 'private' && participantIds.length === 1) {
            const existingConv = await Conversation.findOne({
                type: 'private',
                'participants.userId': { $all: [userId, participantIds[0]] }
            })

            if (existingConv) {
                return res.json({
                    id: existingConv._id,
                    ...existingConv.toObject()
                })
            }
        }

        const participants = [
            { userId, role: 'admin', joinedAt: new Date() },
            ...participantIds.map((id: string) => ({
                userId: id,
                role: type === 'private' ? 'member' : 'member',
                joinedAt: new Date()
            }))
        ]

        const conversation = await Conversation.create({
            type,
            name: type === 'group' ? name : undefined,
            participants
        })

        res.status(201).json({
            id: conversation._id,
            ...conversation.toObject()
        })
    } catch (error) {
        console.error('Error creating conversation:', error)
        res.status(500).json({ message: 'Failed to create conversation' })
    }
})

// Get conversation by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            'participants.userId': userId
        })

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' })
        }

        res.json({
            id: conversation._id,
            ...conversation.toObject()
        })
    } catch (error) {
        console.error('Error fetching conversation:', error)
        res.status(500).json({ message: 'Failed to fetch conversation' })
    }
})

// Get messages for a conversation
router.get('/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { before, limit = 50 } = req.query

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            'participants.userId': userId
        })

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' })
        }

        const query: any = { conversationId: req.params.id }
        if (before) {
            query.createdAt = { $lt: new Date(before as string) }
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))

        res.json(messages.reverse())
    } catch (error) {
        console.error('Error fetching messages:', error)
        res.status(500).json({ message: 'Failed to fetch messages' })
    }
})

// Send a message
router.post('/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { type, content, replyTo } = req.body

        // Verify user is participant
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            'participants.userId': userId
        })

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' })
        }

        const message = await Message.create({
            conversationId: req.params.id,
            senderId: userId,
            type,
            content,
            replyTo
        })

        // Update conversation's last message
        await Conversation.findByIdAndUpdate(req.params.id, {
            lastMessage: {
                content: content.text || '[Media]',
                type,
                senderId: userId,
                timestamp: new Date()
            }
        })

        res.status(201).json(message)
    } catch (error) {
        console.error('Error sending message:', error)
        res.status(500).json({ message: 'Failed to send message' })
    }
})

// Mark message as read
router.post('/:id/messages/:messageId/read', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id

        await Message.findByIdAndUpdate(req.params.messageId, {
            $push: {
                readBy: { userId, readAt: new Date() }
            }
        })

        // Update participant's lastRead
        await Conversation.updateOne(
            { _id: req.params.id, 'participants.userId': userId },
            { $set: { 'participants.$.lastRead': new Date() } }
        )

        res.json({ success: true })
    } catch (error) {
        console.error('Error marking as read:', error)
        res.status(500).json({ message: 'Failed to mark as read' })
    }
})

// Delete a message
router.delete('/:id/messages/:messageId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id

        const message = await Message.findOneAndUpdate(
            { _id: req.params.messageId, senderId: userId },
            { isDeleted: true },
            { new: true }
        )

        if (!message) {
            return res.status(404).json({ message: 'Message not found or not authorized' })
        }

        res.json({ success: true })
    } catch (error) {
        console.error('Error deleting message:', error)
        res.status(500).json({ message: 'Failed to delete message' })
    }
})

export default router
