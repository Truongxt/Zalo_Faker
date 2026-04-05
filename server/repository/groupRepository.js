const ConversationModel = require("../models/conversation.js");
const MessageModel = require("../models/message.js");

const GroupRepository = {
  async createGroup(conversationData) {
    return ConversationModel.createConversation(conversationData);
  },

  async getById(id) {
    return ConversationModel.getOneConversation(id);
  },

  async getAllGroups() {
    const conversations = await ConversationModel.getConversations();
    return conversations.filter((conversation) => conversation.type === "group");
  },

  async getGroupsByUserId(userId) {
    const conversations = await ConversationModel.getConversations(userId);
    return conversations.filter((conversation) => conversation.type === "group");
  },

  async findByInviteCode(inviteCode) {
    if (!inviteCode) {
      return null;
    }

    const groups = await this.getAllGroups();
    return (
      groups.find(
        (group) =>
          group?.groupSettings?.invite?.code &&
          String(group.groupSettings.invite.code).toLowerCase() ===
            String(inviteCode).toLowerCase()
      ) || null
    );
  },

  async update(id, updates) {
    return ConversationModel.updateConversation(id, updates);
  },

  async deleteById(id) {
    return ConversationModel.deleteConversation(id);
  },

  async deleteMessagesByConversationId(conversationId) {
    return MessageModel.deleteMessagesByConversationId(conversationId);
  },

  async getMessageById(messageId) {
    return MessageModel.getOneMessage(messageId);
  }
};

module.exports = GroupRepository;
