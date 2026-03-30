const conversationService = require("../services/conversationService")

const createConversation = async (req, res) => {
    try {
        const conversation = await conversationService.createConversation(req.body)
        res.json(conversation)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getConversation = async (req, res) => {
    try {
        const conversation = await conversationService.getConversation(req.params.id)
        res.json(conversation)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const getConversations = async (req, res) => {
    try {
        const userId = req.user.userId;
        const conversations = await conversationService.getConversations(userId)
        res.json(conversations)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const updateConversation = async (req, res) => {
    try {
        const conversation = await conversationService.updateConversation(req.params.id, req.body)
        res.json(conversation)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

const deleteConversation = async (req, res) => {
    try {
        const conversation = await conversationService.deleteConversation(req.params.id)
        res.json(conversation)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// const getConversationsByUserId = async (req, res) => {
//     try {
//         const conversations = await conversationService.getConversationsByUserId(req.params.userId)
//         res.json(conversations)
//     } catch (error) {
//         res.status(500).json({ message: error.message })
//     }
// }

module.exports = {
    createConversation,
    getConversation,
    getConversations,
    updateConversation,
    deleteConversation,
}