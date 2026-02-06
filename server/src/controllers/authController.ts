import { Request, Response, NextFunction } from 'express'
import { User } from '../models/index.js'
import { supabaseAdmin } from '../config/supabase.js'

// ==================== AUTH CONTROLLER ====================
// Xử lý đăng ký, đăng nhập, đăng xuất

// POST /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, fullName } = req.body

        // 1. Validate input
        if (!email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin'
            })
        }

        // 2. Đăng ký với Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Tự động xác nhận email
            user_metadata: { full_name: fullName }
        })

        if (authError) {
            return res.status(400).json({
                success: false,
                message: authError.message
            })
        }

        // 3. Tạo user profile trong MongoDB
        const user = await User.create({
            supabaseId: authData.user.id,
            email,
            fullName,
            status: 'online'
        })

        // 4. Trả về response
        return res.status(201).json({
            success: true,
            message: 'Đăng ký thành công',
            data: {
                id: user.supabaseId,
                email: user.email,
                fullName: user.fullName
            }
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body

        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email và mật khẩu'
            })
        }

        // 2. Đăng nhập với Supabase
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng'
            })
        }

        // 3. Cập nhật trạng thái online
        await User.findOneAndUpdate(
            { supabaseId: data.user.id },
            { status: 'online', lastSeen: new Date() }
        )

        // 4. Trả về token và user info
        return res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công',
            data: {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    fullName: data.user.user_metadata?.full_name
                }
            }
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/auth/logout
export const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id

        if (userId) {
            // Cập nhật trạng thái offline
            await User.findOneAndUpdate(
                { supabaseId: userId },
                { status: 'offline', lastSeen: new Date() }
            )
        }

        return res.status(200).json({
            success: true,
            message: 'Đăng xuất thành công'
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/auth/refresh
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            })
        }

        const { data, error } = await supabaseAdmin.auth.refreshSession({
            refresh_token: refreshToken
        })

        if (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            })
        }

        return res.status(200).json({
            success: true,
            data: {
                accessToken: data.session?.access_token,
                refreshToken: data.session?.refresh_token
            }
        })

    } catch (error) {
        next(error)
    }
}
