import { Server, Socket } from 'socket.io'
import { supabaseAdmin } from '../config/supabase.js'
import { chatSocketHandler } from './chat.socket.js'
import { callSocketHandler } from './call.socket.js'
import { presenceSocketHandler } from './presence.socket.js'

// Map of userId -> socketId
const userSockets = new Map<string, string>()

export function setupSocketHandlers(io: Server) {
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token

            if (!token) {
                return next(new Error('No token provided'))
            }

            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

            if (error || !user) {
                return next(new Error('Invalid token'))
            }

            socket.data.userId = user.id
            socket.data.email = user.email
            next()
        } catch (error) {
            next(new Error('Authentication failed'))
        }
    })

    io.on('connection', (socket: Socket) => {
        const userId = socket.data.userId
        console.log(`User connected: ${userId}`)

        // Store socket mapping
        userSockets.set(userId, socket.id)

        // Join user's personal room
        socket.join(`user:${userId}`)

        // Setup handlers
        chatSocketHandler(io, socket, userSockets)
        callSocketHandler(io, socket, userSockets)
        presenceSocketHandler(io, socket, userSockets)

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${userId}`)
            userSockets.delete(userId)

            // Broadcast offline status
            socket.broadcast.emit('user:offline', { userId })
        })
    })
}

export { userSockets }
