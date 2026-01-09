import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../../middleware/auth.js'
import { Conversation } from '../chat/chat.model.js'

const router = Router()

// Create a group
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { name, memberIds, avatar } = req.body

        if (!name) {
            return res.status(400).json({ message: 'Group name is required' })
        }

        const participants = [
            { userId, role: 'admin' as const, joinedAt: new Date() },
            ...(memberIds || []).map((id: string) => ({
                userId: id,
                role: 'member' as const,
                joinedAt: new Date()
            }))
        ]

        const group = await Conversation.create({
            type: 'group',
            name,
            avatar,
            participants
        })

        res.status(201).json({
            id: group._id,
            ...group.toObject()
        })
    } catch (error) {
        console.error('Error creating group:', error)
        res.status(500).json({ message: 'Failed to create group' })
    }
})

// Update group info
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { name, avatar } = req.body

        // Check if user is admin
        const group = await Conversation.findOne({
            _id: req.params.id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!group) {
            return res.status(403).json({ message: 'Not authorized or group not found' })
        }

        const updated = await Conversation.findByIdAndUpdate(
            req.params.id,
            { name, avatar },
            { new: true }
        )

        res.json({
            id: updated!._id,
            ...updated!.toObject()
        })
    } catch (error) {
        console.error('Error updating group:', error)
        res.status(500).json({ message: 'Failed to update group' })
    }
})

// Delete group
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id

        const group = await Conversation.findOneAndDelete({
            _id: req.params.id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!group) {
            return res.status(403).json({ message: 'Not authorized or group not found' })
        }

        res.json({ message: 'Group deleted' })
    } catch (error) {
        console.error('Error deleting group:', error)
        res.status(500).json({ message: 'Failed to delete group' })
    }
})

// Add members
router.post('/:id/members', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { memberIds } = req.body

        const group = await Conversation.findOne({
            _id: req.params.id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!group) {
            return res.status(403).json({ message: 'Not authorized or group not found' })
        }

        const newMembers = memberIds.map((id: string) => ({
            userId: id,
            role: 'member',
            joinedAt: new Date()
        }))

        await Conversation.findByIdAndUpdate(req.params.id, {
            $push: { participants: { $each: newMembers } }
        })

        res.json({ message: 'Members added' })
    } catch (error) {
        console.error('Error adding members:', error)
        res.status(500).json({ message: 'Failed to add members' })
    }
})

// Remove member
router.delete('/:id/members/:memberId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { memberId } = req.params

        const group = await Conversation.findOne({
            _id: req.params.id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!group) {
            return res.status(403).json({ message: 'Not authorized or group not found' })
        }

        await Conversation.findByIdAndUpdate(req.params.id, {
            $pull: { participants: { userId: memberId } }
        })

        res.json({ message: 'Member removed' })
    } catch (error) {
        console.error('Error removing member:', error)
        res.status(500).json({ message: 'Failed to remove member' })
    }
})

// Leave group
router.post('/:id/leave', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id

        const group = await Conversation.findOne({
            _id: req.params.id,
            type: 'group',
            'participants.userId': userId
        })

        if (!group) {
            return res.status(404).json({ message: 'Group not found' })
        }

        // If leaving user is admin, assign new admin or delete group
        const isAdmin = group.participants.some(p => p.userId === userId && p.role === 'admin')
        const otherMembers = group.participants.filter(p => p.userId !== userId)

        if (otherMembers.length === 0) {
            await Conversation.findByIdAndDelete(req.params.id)
            return res.json({ message: 'Group deleted (no members left)' })
        }

        if (isAdmin) {
            // Make first member admin
            await Conversation.updateOne(
                { _id: req.params.id, 'participants.userId': otherMembers[0].userId },
                { $set: { 'participants.$.role': 'admin' } }
            )
        }

        await Conversation.findByIdAndUpdate(req.params.id, {
            $pull: { participants: { userId } }
        })

        res.json({ message: 'Left group' })
    } catch (error) {
        console.error('Error leaving group:', error)
        res.status(500).json({ message: 'Failed to leave group' })
    }
})

// Update member role
router.put('/:id/members/:memberId/role', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.id
        const { memberId } = req.params
        const { role } = req.body

        const group = await Conversation.findOne({
            _id: req.params.id,
            type: 'group',
            participants: { $elemMatch: { userId, role: 'admin' } }
        })

        if (!group) {
            return res.status(403).json({ message: 'Not authorized or group not found' })
        }

        await Conversation.updateOne(
            { _id: req.params.id, 'participants.userId': memberId },
            { $set: { 'participants.$.role': role } }
        )

        res.json({ message: 'Role updated' })
    } catch (error) {
        console.error('Error updating role:', error)
        res.status(500).json({ message: 'Failed to update role' })
    }
})

export default router
