const messageService = require("../services/messageService")
const conversationService = require("../services/conversationService")
const GroupService = require("../services/groupService")
const conversationModel = require("../models/conversation")

const createMessage = async (req, res) => {
    try {
        const senderId = req.user?.userId
        const payload = {
            ...req.body,
            senderId
        }

        if (!senderId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        if (!payload.conversationId) {
            return res.status(400).json({ message: "conversationId is required" })
        }

        const conversation = await conversationService.getConversation(payload.conversationId)

        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" })
        }

        if (conversation.type === "group") {
            GroupService.ensureCanSendMessage(conversation, {
                userId: senderId,
                type: payload.type,
                metadata: payload.metadata
            })
        }

        const message = await messageService.createMessage(payload)
        const normalizedMessage = { ...message, id: message._id }

        const lastMessageContent = payload.metadata?.isAnnouncement
            ? `[Thông báo] ${payload.content?.text || ""}`.trim()
            : payload.content?.text
                || (payload.type === "image"
                    ? "[Hình ảnh]"
                    : payload.type === "video"
                        ? "[Video]"
                        : payload.type === "voice"
                            ? "[Tin nhắn thoại]"
                            : payload.type === "sticker"
                                ? "[Nhãn dán]"
                                : "[File]")

        await conversationModel.updateConversation(payload.conversationId, {
            lastMessage: {
                content: lastMessageContent,
                type: payload.type || "text",
                senderId,
                timestamp: message.createdAt,
            },
        })

        const io = req.app.get("io")
        if (io) {
            io.to(`conv:${payload.conversationId}`).emit("chat:message", normalizedMessage)
            // Backward compatibility for any legacy clients still listening old room id
            io.to(payload.conversationId).emit("chat:message", normalizedMessage)
        }

        res.json(normalizedMessage)
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message })
    }
}

const getMessage = async (req, res) => {
    try {
        const message = await messageService.getMessage(req.params.id)
        res.json(message)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getMessages = async (req, res) => {
    try {
        const messages = await messageService.getMessages()
        res.json(messages)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const updateMessage = async (req, res) => {
    try {
        const message = await messageService.updateMessage(req.params.id, req.body)
        res.json(message)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const deleteMessage = async (req, res) => {
    try {
        const message = await messageService.deleteMessage(req.params.id)
        res.json(message)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getMessagesByConversationId = async (req, res) => {
    try {
        const messages = await messageService.getMessagesByConversationId(req.params.conversationId)
        res.json(messages)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const deleteMessagesByRoom = async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const result = await messageService.deleteMessagesByConversationId(roomId)
        await conversationModel.updateConversation(roomId, {
            lastMessage: null
        })
        res.json(result)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getStickers = async (req, res) => {
    try {
        const stickers = await messageService.getStickers()
        res.json(stickers)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

module.exports = {
    createMessage,
    getMessage,
    getMessages,
    updateMessage,
    deleteMessage,
    getMessagesByConversationId,
    deleteMessagesByRoom,
    getStickers
}
