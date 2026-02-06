import { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabase.js'

// ==================== AUTH MIDDLEWARE ====================
// Kiểm tra JWT token từ Supabase

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Lấy token từ header
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập'
            })
        }

        const token = authHeader.split(' ')[1]

        // Verify token với Supabase
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ hoặc đã hết hạn'
            })
        }

        // Gắn user info vào request
        ; (req as any).user = {
            id: user.id,
            email: user.email,
            fullName: user.user_metadata?.full_name
        }

        next()
    } catch (error) {
        console.error('Auth middleware error:', error)
        return res.status(500).json({
            success: false,
            message: 'Lỗi xác thực'
        })
    }
}
