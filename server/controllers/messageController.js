const messageService = require("../services/messageService")
const conversationService = require("../services/conversationService")
const GroupService = require("../services/groupService")
const PollService = require("../services/pollService")
const conversationModel = require("../models/conversation")
const friendService = require("../services/friendService")

const normalizeCallType = (value) => {
    const normalized = String(value || "").trim().toLowerCase()
    if (normalized === "video") return "video"
    if (normalized === "audio" || normalized === "voice") return "audio"
    return ""
}

const normalizeCallStatus = (value) => {
    const normalized = String(value || "").trim().toLowerCase()
    if (!normalized) return ""
    return normalized === "ended" ? "finished" : normalized
}

const parseCallPayloadFromObject = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const callType = normalizeCallType(value.callType)
    const status = normalizeCallStatus(value.status || value.callStatus)
    if (!callType || !status) return null
    return { callType, status }
}

const parseCallPayload = (content) => {
    if (!content) return null

    if (typeof content === "string") {
        const trimmed = content.trim()
        if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null

        try {
            return parseCallPayloadFromObject(JSON.parse(trimmed))
        } catch {
            return null
        }
    }

    if (typeof content !== "object" || Array.isArray(content)) return null

    const direct = parseCallPayloadFromObject(content)
    if (direct) return direct

    const nestedText =
        typeof content.text === "string"
            ? content.text
            : typeof content.message === "string"
                ? content.message
                : typeof content.content === "string"
                    ? content.content
                    : ""

    return nestedText ? parseCallPayload(nestedText) : null
}

const getCallPreviewText = (callPayload) => {
    const suffix = callPayload.callType === "video" ? " video" : ""
    if (callPayload.status === "finished") return `Cuoc goi${suffix}`
    if (callPayload.status === "missed") return `Cuoc goi nho${suffix}`
    if (callPayload.status === "rejected") return "Cuoc goi bi tu choi"
    if (callPayload.status === "cancelled") return "Cuoc goi da huy"
    return callPayload.callType === "video" ? "Cuoc goi video" : "Cuoc goi"
}

const getLastMessageContent = ({ type, content, metadata }) => {
    if (type === PollService.POLL_MESSAGE_TYPE) {
        return PollService.getPollPreviewText(content)
    }

    const callPayload = parseCallPayload(content)
    const contentText =
        typeof content === "string"
            ? content
            : typeof content?.text === "string"
                ? content.text
                : ""

    const baseText = (type === "call" || callPayload)
        ? getCallPreviewText(callPayload || { callType: "audio", status: "finished" })
        : contentText
        || (type === "image"
            ? "[Hình ảnh]"
            : type === "video"
                ? "[Video]"
                : type === "voice"
                    ? "[Tin nhắn thoại]"
                    : type === "sticker"
                        ? "[Nhãn dán]"
                        : type === "call"
                            ? "[Cuoc goi]"
                            : "[File]")

    const prefixes = []
    if (metadata?.isImportant) prefixes.push("[Quan trọng]")
    if (metadata?.isAnnouncement) prefixes.push("[Thông báo]")

    return [...prefixes, baseText].join(" ").trim()
}

const getOtherParticipantId = (conversation, userId) => {
    if (!conversation || conversation.type !== "private") return null
    const selfId = String(userId)
    const otherParticipant = (conversation.participants || []).find(
        (participant) => String(participant.userId) !== selfId
    )
    return otherParticipant ? Number(otherParticipant.userId) : null
}

const isConversationMember = (conversation, userId) =>
    Boolean(
        conversation?.participants?.some(
            (participant) => String(participant.userId) === String(userId)
        )
    )

const emitMessageUpdated = (req, updatedMessage) => {
    const io = req.app.get("io")
    if (!io || !updatedMessage?.conversationId) return

    const normalizedMessage = { ...updatedMessage, id: updatedMessage._id }
    io.to(`conv:${updatedMessage.conversationId}`).emit("chat:message_updated", {
        conversationId: updatedMessage.conversationId,
        message: normalizedMessage
    })
    io.to(updatedMessage.conversationId).emit("chat:message_updated", {
        conversationId: updatedMessage.conversationId,
        message: normalizedMessage
    })
}

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

        if (payload.type === PollService.POLL_MESSAGE_TYPE) {
            if (conversation.type !== "group") {
                return res.status(400).json({ message: "Polls are only supported in group conversations" })
            }
            payload.content = PollService.normalizePollMessageContent(payload.content, senderId)
        }

        if (conversation.type === "group") {
            GroupService.ensureCanSendMessage(conversation, {
                userId: senderId,
                type: payload.type,
                metadata: payload.metadata
            })
        } else {
            const otherUserId = getOtherParticipantId(conversation, senderId)
            if (otherUserId) {
                await friendService.ensureCanMessageBetweenUsers(senderId, otherUserId)
            }
        }

        const message = await messageService.createMessage(payload)
        const normalizedMessage = { ...message, id: message._id }

        await conversationModel.updateConversation(payload.conversationId, {
            lastMessage: {
                content: getLastMessageContent({
                    type: payload.type,
                    content: payload.content,
                    metadata: payload.metadata,
                }),
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
        res.status(error.statusCode || 500).json({
            message: error.message,
            code: error.code || undefined
        })
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

const votePoll = async (req, res) => {
    try {
        const userId = req.user?.userId
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const message = await messageService.getMessage(req.params.id)
        if (!message) {
            return res.status(404).json({ message: "Message not found" })
        }

        const conversation = await conversationService.getConversation(message.conversationId)
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" })
        }

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Polls are only supported in group conversations" })
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: "You are not in this conversation" })
        }

        const nextPoll = PollService.voteOnPoll(message, {
            userId,
            optionIds: req.body?.optionIds,
        })

        const updatedMessage = await messageService.updateMessage(req.params.id, {
            content: nextPoll,
        })

        emitMessageUpdated(req, updatedMessage)
        return res.json({ ...updatedMessage, id: updatedMessage._id })
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message,
            code: error.code || undefined,
        })
    }
}

const addPollOption = async (req, res) => {
    try {
        const userId = req.user?.userId
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const message = await messageService.getMessage(req.params.id)
        if (!message) {
            return res.status(404).json({ message: "Message not found" })
        }

        const conversation = await conversationService.getConversation(message.conversationId)
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" })
        }

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Polls are only supported in group conversations" })
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: "You are not in this conversation" })
        }

        const nextPoll = PollService.addOptionToPoll(message, {
            userId,
            text: req.body?.text,
        })

        const updatedMessage = await messageService.updateMessage(req.params.id, {
            content: nextPoll,
        })

        emitMessageUpdated(req, updatedMessage)
        return res.json({ ...updatedMessage, id: updatedMessage._id })
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message,
            code: error.code || undefined,
        })
    }
}

const removePollOption = async (req, res) => {
    try {
        const userId = req.user?.userId
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" })
        }

        const message = await messageService.getMessage(req.params.id)
        if (!message) {
            return res.status(404).json({ message: "Message not found" })
        }

        const conversation = await conversationService.getConversation(message.conversationId)
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" })
        }

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Polls are only supported in group conversations" })
        }

        if (!isConversationMember(conversation, userId)) {
            return res.status(403).json({ message: "You are not in this conversation" })
        }

        const nextPoll = PollService.removeOptionFromPoll(message, {
            userId,
            optionId: req.params.optionId,
        })

        const updatedMessage = await messageService.updateMessage(req.params.id, {
            content: nextPoll,
        })

        emitMessageUpdated(req, updatedMessage)
        return res.json({ ...updatedMessage, id: updatedMessage._id })
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message,
            code: error.code || undefined,
        })
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
    getStickers,
    votePoll,
    addPollOption,
    removePollOption
}

