const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");

router.post("/", messageController.createMessage);
router.get("/", messageController.getMessages);

// ⚠️ Route cụ thể PHẢI đặt TRƯỚC route /:id
// Nếu không, Express sẽ match "conversation" là :id
router.get("/conversation/:conversationId", messageController.getMessagesByConversationId);
router.delete("/room/:roomId", messageController.deleteMessagesByRoom);

router.get("/:id", messageController.getMessage);
router.put("/:id", messageController.updateMessage);
router.delete("/:id", messageController.deleteMessage);

module.exports = router;
