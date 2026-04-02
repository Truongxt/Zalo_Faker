const messageModel = require("../models/message")

const createMessage = async (message) => {
    return await messageModel.createMessage(message)
}

const getMessage = async (id) => {
    return await messageModel.getOneMessage(id)
}

// get message of conversation
const getMessagesByConversationId = async (conversationId) => {
    return await messageModel.getMessagesByConversationId(conversationId)
}

const getMessages = async () => {
    return await messageModel.getMessages()
}

const updateMessage = async (id, message) => {
    return await messageModel.updateMessage(id, message, { new: true })
}

const deleteMessage = async (id) => {
    return await messageModel.deleteMessage(id)
}

const deleteMessagesByConversationId = async (conversationId) => {
    return await messageModel.deleteMessagesByConversationId(conversationId)
}

module.exports = {
    createMessage,
    getMessage,
    getMessages,
    updateMessage,
    deleteMessage,
    getMessagesByConversationId,
    deleteMessagesByConversationId
}