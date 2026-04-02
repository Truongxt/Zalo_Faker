const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversationController");

router.post("/", conversationController.createConversation);
router.get("/", conversationController.getConversations);
router.get("/:id", conversationController.getConversation);
router.put("/:id", conversationController.updateConversation);
router.patch("/:id/setting", conversationController.updateParticipantSetting);
router.delete("/:id", conversationController.deleteConversation);

module.exports = router;    