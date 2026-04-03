const messageService = require("../services/messageService")

const createMessage = async (req, res) => {
    try {
        const message = await messageService.createMessage(req.body)
        res.json(message)
    } catch (error) {
        res.status(500).json({ message: error.message })
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
        const result = await messageService.deleteMessagesByConversationId(req.params.roomId)
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