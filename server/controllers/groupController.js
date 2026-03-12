const ConversationModel = require("../models/conversation.js");
const { createParticipant } = require("../models/participant.js");

const GroupController = {

  // =========================
  // CREATE GROUP
  // =========================
  createGroup: async (req, res) => {
    try {
      const { name, avatar, memberIds = [], createdBy } = req.body;

      const participants = [
        createParticipant({ userId: createdBy, role: "admin" }),
        ...memberIds.map(id =>
          createParticipant({ userId: id, role: "member" })
        )
      ];

      const conversation = await ConversationModel.createConversation({
        type: "group",
        name,
        avatar,
        participants,
        createdBy
      });

      res.status(201).json(conversation);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // =========================
  // RENAME GROUP (mọi người được quyền)
  // =========================
  renameGroup: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, userId } = req.body;

      const group = await ConversationModel.getOneConversation(id);
      if (!group) return res.status(404).json({ message: "Group not found" });

      const isMember = group.participants.find(p => p.userId === userId);
      if (!isMember)
        return res.status(403).json({ message: "You are not in this group" });

      const updated = await ConversationModel.updateConversation(id, { name });
      res.json(updated);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // =========================
  // UPDATE AVATAR (mọi người được quyền)
  // =========================
  updateAvatar: async (req, res) => {
    try {
      const { id } = req.params;
      const { avatar, userId } = req.body;

      const group = await ConversationModel.getOneConversation(id);
      if (!group) return res.status(404).json({ message: "Group not found" });

      const isMember = group.participants.find(p => p.userId === userId);
      if (!isMember)
        return res.status(403).json({ message: "You are not in this group" });

      const updated = await ConversationModel.updateConversation(id, { avatar });
      res.json(updated);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // =========================
  // ADD MEMBER (mọi người được quyền)
  // =========================
  addMember: async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, newUserId } = req.body;

      const group = await ConversationModel.getOneConversation(id);
      if (!group) return res.status(404).json({ message: "Group not found" });

      const isMember = group.participants.find(p => p.userId === userId);
      if (!isMember)
        return res.status(403).json({ message: "You are not in this group" });

      const exists = group.participants.find(p => p.userId === newUserId);
      if (exists)
        return res.status(400).json({ message: "User already in group" });

      const newParticipant = createParticipant({
        userId: newUserId,
        role: "member"
      });

      const updated = await ConversationModel.updateConversation(id, {
        participants: [...group.participants, newParticipant]
      });

      res.json(updated);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // =========================
  // REMOVE MEMBER (CHỈ ADMIN)
  // =========================
  removeMember: async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, removeUserId } = req.body;

      const group = await ConversationModel.getOneConversation(id);
      if (!group) return res.status(404).json({ message: "Group not found" });

      const isAdmin = group.participants.find(
        p => p.userId === userId && p.role === "admin"
      );

      if (!isAdmin)
        return res.status(403).json({ message: "Only admin can remove member" });

      const updatedParticipants = group.participants.filter(
        p => p.userId !== removeUserId
      );

      const updated = await ConversationModel.updateConversation(id, {
        participants: updatedParticipants
      });

      res.json(updated);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // =========================
  // LEAVE GROUP (mọi người được quyền)
  // =========================
  leaveGroup: async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const group = await ConversationModel.getOneConversation(id);
      if (!group) return res.status(404).json({ message: "Group not found" });

      const updatedParticipants = group.participants.filter(
        p => p.userId !== userId
      );

      const updated = await ConversationModel.updateConversation(id, {
        participants: updatedParticipants
      });

      res.json(updated);

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

};

module.exports = GroupController;