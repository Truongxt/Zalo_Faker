import { Router } from 'express'
import multer from 'multer'
import { authMiddleware, AuthRequest } from '../../middleware/auth.js'
import cloudinary from '../../config/cloudinary.js'

const router = Router()

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    }
})

// Upload image
router.post('/image', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' })
        }

        // Convert buffer to base64
        const base64 = req.file.buffer.toString('base64')
        const dataUri = `data:${req.file.mimetype};base64,${base64}`

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'zalo-faker/images',
            transformation: [
                { width: 1200, crop: 'limit' },
                { quality: 'auto' }
            ],
            eager: [
                { width: 200, height: 200, crop: 'thumb' }
            ]
        })

        res.json({
            url: result.secure_url,
            thumbnail: result.eager?.[0]?.secure_url || result.secure_url,
            width: result.width,
            height: result.height
        })
    } catch (error) {
        console.error('Error uploading image:', error)
        res.status(500).json({ message: 'Failed to upload image' })
    }
})

// Upload video
router.post('/video', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' })
        }

        // Convert buffer to base64
        const base64 = req.file.buffer.toString('base64')
        const dataUri = `data:${req.file.mimetype};base64,${base64}`

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'zalo-faker/videos',
            resource_type: 'video',
            eager: [
                { format: 'mp4', quality: 'auto' }
            ],
            eager_async: true
        })

        res.json({
            url: result.secure_url,
            thumbnail: result.secure_url.replace(/\.[^/.]+$/, '.jpg'),
            duration: result.duration,
            width: result.width,
            height: result.height
        })
    } catch (error) {
        console.error('Error uploading video:', error)
        res.status(500).json({ message: 'Failed to upload video' })
    }
})

// Upload document
router.post('/document', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' })
        }

        // Convert buffer to base64
        const base64 = req.file.buffer.toString('base64')
        const dataUri = `data:${req.file.mimetype};base64,${base64}`

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'zalo-faker/documents',
            resource_type: 'raw',
            use_filename: true
        })

        res.json({
            url: result.secure_url,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        })
    } catch (error) {
        console.error('Error uploading document:', error)
        res.status(500).json({ message: 'Failed to upload document' })
    }
})

// Upload avatar
router.post('/avatar', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' })
        }

        const userId = req.user!.id
        const base64 = req.file.buffer.toString('base64')
        const dataUri = `data:${req.file.mimetype};base64,${base64}`

        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'zalo-faker/avatars',
            public_id: userId,
            overwrite: true,
            transformation: [
                { width: 200, height: 200, crop: 'fill', gravity: 'face' },
                { quality: 'auto' }
            ]
        })

        res.json({
            url: result.secure_url
        })
    } catch (error) {
        console.error('Error uploading avatar:', error)
        res.status(500).json({ message: 'Failed to upload avatar' })
    }
})

export default router
