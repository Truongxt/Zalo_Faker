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
 * @swagger
 * /ai/summarize/{conversationId}:
 *   get:
 *     summary: Tóm tắt trò chuyện trong ngày bằng AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của cuộc hội thoại cần tóm tắt
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-04-16"
 *         description: Ngày cần tóm tắt (định dạng yyyy-mm-dd). Mặc định là hôm nay (UTC).
 *       - in: query
 *         name: tzOffsetMinutes
 *         required: false
 *         schema:
 *           type: integer
 *           example: -420
 *         description: Giá trị từ Date.getTimezoneOffset() của client để xác định đúng "trong ngày" theo múi giờ người dùng.
 *     responses:
 *       200:
 *         description: Tóm tắt thành công
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
 *                     conversationId:
 *                       type: string
 *                       example: "conv-123"
 *                     conversationName:
 *                       type: string
 *                       example: "Nhóm dự án CNM"
 *                     summary:
 *                       type: string
 *                       example: "Hôm nay nhóm thảo luận về kế hoạch sprint tuần tới..."
 *                     messageCount:
 *                       type: integer
 *                       example: 42
 *                     date:
 *                       type: string
 *                       example: "2026-04-16"
 *                     tzOffsetMinutes:
 *                       type: integer
 *                       example: -420
 *       400:
 *         description: Thiếu conversationId
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server
 */
router.get("/summarize/:conversationId", auth, summarizeConversation);

module.exports = router;