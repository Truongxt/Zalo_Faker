// ==================== MAIN APP ====================
// Entry point của server

// Load environment variables FIRST
import './config/env.js'

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

// Config
import { config } from './config/env.js'
import { connectMongoDB } from './config/database.js'

// Routes (MVC pattern)
import routes from './routes/index.js'

// Middlewares
import { errorMiddleware } from './middlewares/index.js'

// Socket handlers
import { setupSocket } from './socket/index.js'

// Create Express app
const app = express()
const httpServer = createServer(app)

// Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: config.clientUrl,
        methods: ['GET', 'POST'],
        credentials: true
    }
})

// ==================== MIDDLEWARES ====================
app.use(helmet())
app.use(cors({
    origin: config.clientUrl,
    credentials: true
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    })
})

// API routes
app.use('/api', routes)

// ==================== SOCKET.IO ====================
setupSocket(io)

// ==================== ERROR HANDLING ====================
app.use(errorMiddleware)

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route không tồn tại'
    })
})

// ==================== START SERVER ====================
async function startServer() {
    try {
        // Connect MongoDB
        await connectMongoDB()

        // Start listening
        httpServer.listen(config.port, () => {
            console.log('='.repeat(50))
            console.log(`🚀 Server running on http://localhost:${config.port}`)
            console.log(`📡 Socket.io ready`)
            console.log(`🔧 Environment: ${config.nodeEnv}`)
            console.log('='.repeat(50))
        })
    } catch (error) {
        console.error('❌ Failed to start server:', error)
        process.exit(1)
    }
}

startServer()

export { io }
