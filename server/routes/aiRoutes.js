const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
	askAssistant,
	getAssistantHistory,
	deleteAssistantConversationHistory,
	summarizeConversation,
} = require("../controllers/aiController");


const router = express.Router();
/**
 * @swagger
 * /ai/chat:
 *   post:
 *     summary: Chat với AI assistant
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *                 example: "Áo hoodie có hợp với người thấp không?"
 *               conversationId:
 *                 type: string
 *                 example: "conv123"
 *     responses:
 *       200:
 *         description: AI trả lời thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reply:
 *                       type: string
 *                       example: "Áo hoodie vẫn phù hợp với người thấp..."
 *       400:
 *         description: Thiếu dữ liệu
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server
 */

router.post("/chat", auth, askAssistant);
router.get("/history", auth, getAssistantHistory);
router.delete("/history/:conversationId", auth, deleteAssistantConversationHistory);

/**
 * POST /ai/summarize/:conversationId
 * Tóm tắt tin nhắn trong ngày của một cuộc trò chuyện bằng AI
 */
router.post("/summarize/:conversationId", auth, summarizeConversation);


module.exports = router;
