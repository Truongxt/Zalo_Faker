import { Request, Response, NextFunction } from 'express'
import { Message, Conversation } from '../models/index.js'

// ==================== CHAT CONTROLLER ====================
// Xử lý tin nhắn và cuộc hội thoại

// GET /api/conversations
export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id

        const conversations = await Conversation.find({
            'participants.userId': userId
        })
            .sort({ updatedAt: -1 })  // Mới nhất trước
            .limit(50)

        // Tính unread count cho mỗi conversation
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
                    updatedAt: conv.updatedAt
                }
            })
        )

        return res.status(200).json({
            success: true,
            data: result
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/conversations
export const createConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { participantIds, type = 'private', name } = req.body

        // Validate
        if (!participantIds || !Array.isArray(participantIds)) {
            return res.status(400).json({
                success: false,
                message: 'participantIds is required'
            })
        }

        // Với private chat, kiểm tra đã có conversation chưa
        if (type === 'private' && participantIds.length === 1) {
            const existing = await Conversation.findOne({
                type: 'private',
                'participants.userId': { $all: [userId, participantIds[0]] }
            })

            if (existing) {
                return res.status(200).json({
                    success: true,
                    data: existing
                })
            }
        }

        // Tạo conversation mới
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
            participants,
            createdBy: userId
        })

        return res.status(201).json({
            success: true,
            message: 'Tạo cuộc hội thoại thành công',
            data: conversation
        })

    } catch (error) {
        next(error)
    }
}

// GET /api/conversations/:id/messages
export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { id } = req.params
        const { limit = 50, before } = req.query

        // Kiểm tra user có trong conversation không
        const conversation = await Conversation.findOne({
            _id: id,
            'participants.userId': userId
        })

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cuộc hội thoại'
            })
        }

        // Query messages
        const query: any = {
            conversationId: id,
            isDeleted: false
        }

        if (before) {
            query.createdAt = { $lt: new Date(before as string) }
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))

        return res.status(200).json({
            success: true,
            data: messages.reverse()  // Đảo lại để tin cũ ở trên
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/conversations/:id/messages
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { id } = req.params
        const { type = 'text', content, replyTo } = req.body

        // Validate
        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'content is required'
            })
        }

        // Kiểm tra user có trong conversation không
        const conversation = await Conversation.findOne({
            _id: id,
            'participants.userId': userId
        })

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy cuộc hội thoại'
            })
        }

        // Tạo message
        const message = await Message.create({
            conversationId: id,
            senderId: userId,
            type,
            content,
            replyTo
        })

        // Cập nhật lastMessage của conversation
        await Conversation.findByIdAndUpdate(id, {
            lastMessage: {
                content: content.text || `[${type}]`,
                type,
                senderId: userId,
                timestamp: new Date()
            },
            updatedAt: new Date()
        })

        return res.status(201).json({
            success: true,
            message: 'Gửi tin nhắn thành công',
            data: message
        })

    } catch (error) {
        next(error)
    }
}

// DELETE /api/conversations/:id/messages/:messageId
export const deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { messageId } = req.params

        // Chỉ người gửi mới được xóa
        const message = await Message.findOneAndUpdate(
            { _id: messageId, senderId: userId },
            { isDeleted: true },
            { new: true }
        )

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tin nhắn hoặc không có quyền xóa'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Xóa tin nhắn thành công'
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/conversations/:id/messages/:messageId/reactions
export const addReaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { messageId } = req.params
        const { emoji } = req.body

        if (!emoji) {
            return res.status(400).json({
                success: false,
                message: 'emoji is required'
            })
        }

        // Thêm reaction (hoặc thay thế nếu đã có)
        await Message.findByIdAndUpdate(messageId, {
            $pull: { reactions: { userId } }  // Xóa reaction cũ
        })

        const message = await Message.findByIdAndUpdate(
            messageId,
            { $push: { reactions: { userId, emoji } } },
            { new: true }
        )

        return res.status(200).json({
            success: true,
            data: message?.reactions
        })

    } catch (error) {
        next(error)
    }
}
