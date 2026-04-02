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
        const conversations = await conversationService.getConversations()
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

const updateParticipantSetting = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, isPinned, isMuted, nickname } = req.body;

        const conversation = await conversationService.getConversation(id);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        const participants = [...(conversation.participants || [])];
        const participantIndex = participants.findIndex(p => p.userId === userId);
        
        if (participantIndex === -1) {
            return res.status(403).json({ message: "User is not in this conversation" });
        }

        // Cập nhật các trường
        if (isPinned !== undefined) participants[participantIndex].isPinned = isPinned;
        if (isMuted !== undefined) participants[participantIndex].isMuted = isMuted;
        if (nickname !== undefined) participants[participantIndex].nickname = nickname;

        const updated = await conversationService.updateConversation(id, { participants });
        res.json(updated);

    } catch (error) {
        res.status(500).json({ message: error.message });
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
    updateParticipantSetting
}