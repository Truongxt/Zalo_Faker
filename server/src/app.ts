// IMPORTANT: Import env first to load dotenv
import './config/env.js'

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

// Import configurations
import { config, validateConfig } from './config/env.js'
import { connectMongoDB } from './config/database.js'
import { setupSocketHandlers } from './socket/index.js'

// Import routes
import authRoutes from './modules/auth/auth.routes.js'
import userRoutes from './modules/user/user.routes.js'
import conversationRoutes from './modules/chat/conversation.routes.js'
import groupRoutes from './modules/group/group.routes.js'
import mediaRoutes from './modules/media/media.routes.js'
import aiRoutes from './modules/ai/ai.routes.js'

// Validate config on startup
validateConfig()

const app = express()
const httpServer = createServer(app)

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: config.clientUrl,
        methods: ['GET', 'POST'],
        credentials: true
    }
})

// Middleware
app.use(helmet())
app.use(cors({
    origin: config.clientUrl,
    credentials: true
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/ai', aiRoutes)

// Socket.io handlers
setupSocketHandlers(io)

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err)

    const statusCode = err.statusCode || 500
    const message = err.message || 'Internal Server Error'

    res.status(statusCode).json({
        success: false,
        message,
        ...(config.nodeEnv === 'development' && { stack: err.stack })
    })
})

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    })
})

// Start server
async function startServer() {
    try {
        // Connect to MongoDB
        await connectMongoDB()

        httpServer.listen(config.port, () => {
            console.log(`🚀 Server running on http://localhost:${config.port}`)
            console.log(`📡 Socket.io ready for connections`)
            console.log(`🔧 Environment: ${config.nodeEnv}`)
        })
    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}

startServer()

export { io }
