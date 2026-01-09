import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '../config/supabase.js'

export interface AuthRequest extends Request {
    user?: {
        id: string
        email?: string
    }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            })
        }

        const token = authHeader.split(' ')[1]

        // Verify with Supabase
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            })
        }

        req.user = {
            id: user.id,
            email: user.email
        }

        next()
    } catch (error) {
        console.error('Auth middleware error:', error)
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        })
    }
}

export default authMiddleware
