import { Router } from 'express'
import * as groupController from '../controllers/groupController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'

// ==================== GROUP ROUTES ====================
// Endpoints cho quản lý nhóm

const router = Router()

// Tất cả routes đều cần đăng nhập
router.use(authMiddleware)

// POST /api/groups - Tạo nhóm mới
router.post('/', groupController.createGroup)

// PATCH /api/groups/:id - Cập nhật thông tin nhóm
router.patch('/:id', groupController.updateGroup)

// DELETE /api/groups/:id - Xóa nhóm
router.delete('/:id', groupController.deleteGroup)

// POST /api/groups/:id/members - Thêm thành viên
router.post('/:id/members', groupController.addMembers)

// DELETE /api/groups/:id/members/:memberId - Xóa thành viên
router.delete('/:id/members/:memberId', groupController.removeMember)

// POST /api/groups/:id/leave - Rời nhóm
router.post('/:id/leave', groupController.leaveGroup)

export default router
