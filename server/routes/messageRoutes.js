const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const authMiddleware = require("../middlewares/authMiddleware");

router.use(authMiddleware);

router.post("/", messageController.createMessage);
router.get("/", messageController.getMessages);

// ⚠️ Route cụ thể PHẢI đặt TRƯỚC route /:id
// Nếu không, Express sẽ match "conversation" là :id
router.get("/conversation/:conversationId", messageController.getMessagesByConversationId);
router.get("/stickers", messageController.getStickers);
router.delete("/room/:roomId", messageController.deleteMessagesByRoom);
router.post("/:id/poll/vote", messageController.votePoll);
router.post("/:id/poll/options", messageController.addPollOption);
router.delete("/:id/poll/options/:optionId", messageController.removePollOption);
router.post("/:id/delete-for-me", messageController.deleteMessageForMe);
router.delete("/:id/delete-for-me", messageController.deleteMessageForMe);

router.get("/:id", messageController.getMessage);
router.put("/:id", messageController.updateMessage);
router.delete("/:id", messageController.deleteMessage);

module.exports = router;
