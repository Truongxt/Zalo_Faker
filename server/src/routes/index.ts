import { Router } from 'express'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import chatRoutes from './chatRoutes.js'
import groupRoutes from './groupRoutes.js'

// ==================== ROUTES INDEX ====================
// Gom tất cả routes vào một file

const router = Router()

// Mount routes
router.use('/auth', authRoutes)           // /api/auth/...
router.use('/users', userRoutes)          // /api/users/...
router.use('/conversations', chatRoutes)  // /api/conversations/...
router.use('/groups', groupRoutes)        // /api/groups/...

export default router
