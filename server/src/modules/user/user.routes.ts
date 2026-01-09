import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../../middleware/auth.js'
import { supabaseAdmin } from '../../config/supabase.js'

const router = Router()

// Get user profile
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        // For now, get user from Supabase
        const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(req.params.id)

        if (error || !user) {
            return res.status(404).json({ message: 'User not found' })
        }

        res.json({
            id: user.id,
            email: user.email,
            phone: user.phone,
            fullName: user.user_metadata?.full_name || 'User',
            avatarUrl: user.user_metadata?.avatar_url,
            bio: user.user_metadata?.bio,
            createdAt: user.created_at
        })
    } catch (error) {
        console.error('Error fetching user:', error)
        res.status(500).json({ message: 'Failed to fetch user' })
    }
})

// Create user profile (called after Supabase registration)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { id, email, fullName } = req.body

        // Update user metadata in Supabase
        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: { full_name: fullName }
        })

        if (error) {
            console.error('Error updating user:', error)
            return res.status(400).json({ message: error.message })
        }

        res.status(201).json({
            id,
            email,
            fullName,
            message: 'User profile created'
        })
    } catch (error) {
        console.error('Error creating user:', error)
        res.status(500).json({ message: 'Failed to create user profile' })
    }
})

// Update user profile
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id

        // Only allow updating own profile
        if (userId !== req.params.id) {
            return res.status(403).json({ message: 'Not authorized' })
        }

        const { fullName, bio, avatarUrl } = req.body

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
                full_name: fullName,
                bio,
                avatar_url: avatarUrl
            }
        })

        if (error) {
            return res.status(400).json({ message: error.message })
        }

        res.json({
            message: 'Profile updated',
            fullName,
            bio,
            avatarUrl
        })
    } catch (error) {
        console.error('Error updating user:', error)
        res.status(500).json({ message: 'Failed to update profile' })
    }
})

// Search users
router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { q } = req.query

        if (!q || typeof q !== 'string') {
            return res.json([])
        }

        // Note: Supabase doesn't have built-in user search
        // In production, you'd store users in your own database or use Supabase's user table with RLS
        res.json([])
    } catch (error) {
        console.error('Error searching users:', error)
        res.status(500).json({ message: 'Failed to search users' })
    }
})

export default router
