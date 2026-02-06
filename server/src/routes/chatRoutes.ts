import { Router } from 'express'
import * as chatController from '../controllers/chatController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'

// ==================== CHAT ROUTES ====================
// Endpoints cho tin nhắn và cuộc hội thoại

const router = Router()

// Tất cả routes đều cần đăng nhập
router.use(authMiddleware)

// GET /api/conversations - Lấy danh sách cuộc hội thoại
router.get('/', chatController.getConversations)

// POST /api/conversations - Tạo cuộc hội thoại mới
router.post('/', chatController.createConversation)

// GET /api/conversations/:id/messages - Lấy tin nhắn
router.get('/:id/messages', chatController.getMessages)

// POST /api/conversations/:id/messages - Gửi tin nhắn
router.post('/:id/messages', chatController.sendMessage)

// DELETE /api/conversations/:id/messages/:messageId - Xóa tin nhắn
router.delete('/:id/messages/:messageId', chatController.deleteMessage)

// POST /api/conversations/:id/messages/:messageId/reactions - Thêm reaction
router.post('/:id/messages/:messageId/reactions', chatController.addReaction)

export default router
