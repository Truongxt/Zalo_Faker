const conversationModel = require("../models/conversation")
const participantModel = require("../models/participant")

const createConversation = async (conversation) => {
    return await conversationModel.createConversation(conversation)
}

const getConversation = async (id) => {
    return await conversationModel.getOneConversation(id)
}

const getConversations = async () => {
    return await conversationModel.getConversations()
}

const updateConversation = async (id, conversation) => {
    return await conversationModel.updateConversation(id, conversation)
}

const deleteConversation = async (id) => {
    return await conversationModel.deleteConversation(id)
}

module.exports = {
    createConversation,
    getConversation,
    getConversations,
    updateConversation,
    deleteConversation
}
