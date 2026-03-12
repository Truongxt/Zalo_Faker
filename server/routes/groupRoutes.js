const express = require("express");
const router = express.Router();
const GroupController = require("../controllers/groupController");

router.post("/", GroupController.createGroup);
router.put("/:id/rename", GroupController.renameGroup);
router.put("/:id/avatar", GroupController.updateAvatar);
router.put("/:id/add-member", GroupController.addMember);
router.put("/:id/remove-member", GroupController.removeMember);
router.put("/:id/leave", GroupController.leaveGroup);
router.get("/", async (req, res) => {
  try {
    const ConversationModel = require("../models/conversation.js");
    const conversations = await ConversationModel.getConversations();
    const groups = conversations.filter(c => c.type === "group");

    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;