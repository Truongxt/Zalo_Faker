const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversationController");
const authMiddleware = require("../middlewares/authMiddleware");

// Yêu cầu xác thực (đăng nhập) cho tất cả API chat
router.use(authMiddleware);

router.post("/", conversationController.createConversation);
router.get("/", conversationController.getConversations);
router.get("/:id", conversationController.getConversation);
router.put("/:id", conversationController.updateConversation);
router.patch("/:id/setting", conversationController.updateParticipantSetting);
router.put("/:id/pin-message", conversationController.pinMessage);
router.delete("/:id/pin-message", conversationController.unpinMessage);
router.delete("/:id", conversationController.deleteConversation);

module.exports = router;