import { Request, Response, NextFunction } from 'express'
import { Conversation } from '../models/index.js'

// ==================== GROUP CONTROLLER ====================
// Xử lý tạo và quản lý nhóm chat

// POST /api/groups
export const createGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { name, memberIds, avatar } = req.body

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Tên nhóm là bắt buộc'
            })
        }

        const participants = [
            { userId, role: 'admin', joinedAt: new Date() },
            ...(memberIds || []).map((id: string) => ({
                userId: id,
                role: 'member',
                joinedAt: new Date()
            }))
        ]

        const group = await Conversation.create({
            type: 'group',
            name,
            avatar,
            participants,
            createdBy: userId
        })

        return res.status(201).json({
            success: true,
            message: 'Tạo nhóm thành công',
            data: group
        })

    } catch (error) {
        next(error)
    }
}

// PATCH /api/groups/:id
export const updateGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { id } = req.params
        const { name, avatar } = req.body

        // Chỉ admin mới được sửa
        const group = await Conversation.findOneAndUpdate(
            {
                _id: id,
                type: 'group',
                participants: { $elemMatch: { userId, role: 'admin' } }
            },
            {
                ...(name && { name }),
                ...(avatar && { avatar })
            },
            { new: true }
        )

        if (!group) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền hoặc nhóm không tồn tại'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Cập nhật nhóm thành công',
            data: group
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/groups/:id/members
export const addMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { id } = req.params
        const { memberIds } = req.body

        // Kiểm tra quyền admin
        const group = await Conversation.findOne({
            _id: id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!group) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền'
            })
        }

        // Thêm members mới
        const newMembers = memberIds.map((memberId: string) => ({
            userId: memberId,
            role: 'member',
            joinedAt: new Date()
        }))

        await Conversation.findByIdAndUpdate(id, {
            $push: { participants: { $each: newMembers } }
        })

        return res.status(200).json({
            success: true,
            message: 'Thêm thành viên thành công'
        })

    } catch (error) {
        next(error)
    }
}

// DELETE /api/groups/:id/members/:memberId
export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { id, memberId } = req.params

        // Kiểm tra quyền admin
        const group = await Conversation.findOne({
            _id: id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!group) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền'
            })
        }

        await Conversation.findByIdAndUpdate(id, {
            $pull: { participants: { userId: memberId } }
        })

        return res.status(200).json({
            success: true,
            message: 'Xóa thành viên thành công'
        })

    } catch (error) {
        next(error)
    }
}

// POST /api/groups/:id/leave
export const leaveGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { id } = req.params

        const group = await Conversation.findOne({
            _id: id,
            type: 'group',
            'participants.userId': userId
        })

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Nhóm không tồn tại'
            })
        }

        // Nếu là admin cuối cùng, chuyển quyền cho người khác
        const isAdmin = group.participants.some(p => p.userId === userId && p.role === 'admin')
        const otherMembers = group.participants.filter(p => p.userId !== userId)

        if (otherMembers.length === 0) {
            // Xóa nhóm nếu không còn ai
            await Conversation.findByIdAndDelete(id)
            return res.status(200).json({
                success: true,
                message: 'Nhóm đã bị xóa do không còn thành viên'
            })
        }

        if (isAdmin) {
            // Chuyển quyền admin cho người đầu tiên
            await Conversation.updateOne(
                { _id: id, 'participants.userId': otherMembers[0].userId },
                { $set: { 'participants.$.role': 'admin' } }
            )
        }

        // Rời nhóm
        await Conversation.findByIdAndUpdate(id, {
            $pull: { participants: { userId } }
        })

        return res.status(200).json({
            success: true,
            message: 'Rời nhóm thành công'
        })

    } catch (error) {
        next(error)
    }
}

// DELETE /api/groups/:id
export const deleteGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id
        const { id } = req.params

        const result = await Conversation.findOneAndDelete({
            _id: id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!result) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xóa nhóm'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Xóa nhóm thành công'
        })

    } catch (error) {
        next(error)
    }
}
