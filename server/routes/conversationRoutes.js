const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversationController");
const auth = require("../middlewares/authMiddleware");

router.post("/", auth, conversationController.createConversation);
router.get("/", auth, conversationController.getConversations);
router.get("/:id", auth, conversationController.getConversation);
router.put("/:id", auth, conversationController.updateConversation);
router.delete("/:id", auth, conversationController.deleteConversation);

module.exports = router;    