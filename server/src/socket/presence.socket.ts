import { Server, Socket } from 'socket.io'

export function presenceSocketHandler(
    io: Server,
    socket: Socket,
    userSockets: Map<string, string>
) {
    const userId = socket.data.userId

    // Broadcast online status
    socket.broadcast.emit('user:online', { userId })

    // Get online users
    socket.on('presence:get-online', () => {
        const onlineUsers = Array.from(userSockets.keys())
        socket.emit('presence:online-users', { users: onlineUsers })
    })

    // Update status
    socket.on('presence:update-status', (data: { status: 'online' | 'away' | 'busy' }) => {
        socket.broadcast.emit('presence:status-changed', {
            userId,
            status: data.status
        })
    })
}
