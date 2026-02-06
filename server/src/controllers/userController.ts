import { Request, Response, NextFunction } from 'express'
import { User } from '../models/index.js'

// ==================== USER CONTROLLER ====================
// Xử lý thông tin người dùng

// GET /api/users/:id
export const getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params

        const user = await User.findOne({ supabaseId: id })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            })
        }

        return res.status(200).json({
            success: true,
            data: {
                id: user.supabaseId,
                email: user.email,
                fullName: user.fullName,
                phone: user.phone,
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                status: user.status,
                lastSeen: user.lastSeen
            }
        })

    } catch (error) {
        next(error)
    }
}

// GET /api/users/me
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id

        const user = await User.findOne({ supabaseId: userId })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            })
        }

        return res.status(200).json({
            success: true,
            data: user
        })

    } catch (error) {
        next(error)
    }
}

// PATCH /api/users/me
export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { fullName, phone, avatarUrl, bio } = req.body

        const user = await User.findOneAndUpdate(
            { supabaseId: userId },
            {
                ...(fullName && { fullName }),
                ...(phone && { phone }),
                ...(avatarUrl && { avatarUrl }),
                ...(bio && { bio })
            },
            { new: true }  // Trả về document đã update
        )

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Cập nhật thành công',
            data: user
        })

    } catch (error) {
        next(error)
    }
}

// GET /api/users/search?q=keyword
export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q } = req.query
        const userId = (req as any).user?.id

        if (!q || typeof q !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập từ khóa tìm kiếm'
            })
        }

        // Tìm theo tên hoặc email, loại trừ chính mình
        const users = await User.find({
            supabaseId: { $ne: userId },
            $or: [
                { fullName: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ]
        })
            .select('supabaseId fullName email avatarUrl status')
            .limit(20)

        return res.status(200).json({
            success: true,
            data: users.map(u => ({
                id: u.supabaseId,
                fullName: u.fullName,
                email: u.email,
                avatarUrl: u.avatarUrl,
                status: u.status
            }))
        })

    } catch (error) {
        next(error)
    }
}
