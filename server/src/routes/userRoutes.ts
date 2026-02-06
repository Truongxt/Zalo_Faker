import { Router } from 'express'
import * as userController from '../controllers/userController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'

// ==================== USER ROUTES ====================
// Endpoints cho thông tin người dùng

const router = Router()

// GET /api/users/me - Lấy thông tin bản thân
router.get('/me', authMiddleware, userController.getMe)

// PATCH /api/users/me - Cập nhật thông tin
router.patch('/me', authMiddleware, userController.updateMe)

// GET /api/users/search?q=keyword - Tìm kiếm người dùng
router.get('/search', authMiddleware, userController.searchUsers)

// GET /api/users/:id - Lấy thông tin người dùng khác
router.get('/:id', authMiddleware, userController.getUser)

export default router
