const ConversationModel = require("../models/conversation.js");
const MessageModel = require("../models/message.js");

const GroupRepository = {
  async createGroup(conversationData) {
    return ConversationModel.createConversation(conversationData);
  },

  async getById(id) {
    return ConversationModel.getOneConversation(id);
  },

  async getGroupsByUserId(userId) {
    const conversations = await ConversationModel.getConversations(userId);
    return conversations.filter((conversation) => conversation.type === "group");
  },

  async update(id, updates) {
    return ConversationModel.updateConversation(id, updates);
  },

  async deleteById(id) {
    return ConversationModel.deleteConversation(id);
  },

  async deleteMessagesByConversationId(conversationId) {
    return MessageModel.deleteMessagesByConversationId(conversationId);
  }
};

module.exports = GroupRepository;
