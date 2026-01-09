import { Router } from 'express'

const router = Router()

// Auth routes are handled by Supabase on the client
// These are placeholder routes for any server-side auth logic

router.post('/register', async (req, res) => {
    // Registration is handled by Supabase
    // This can be used for additional server-side logic
    res.json({ message: 'Use Supabase client for registration' })
})

router.post('/login', async (req, res) => {
    // Login is handled by Supabase
    res.json({ message: 'Use Supabase client for login' })
})

router.post('/logout', async (req, res) => {
    // Logout is handled by Supabase
    res.json({ message: 'Use Supabase client for logout' })
})

export default router
