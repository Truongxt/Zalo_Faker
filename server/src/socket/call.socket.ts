import { Server, Socket } from 'socket.io'

interface CallData {
    to: string
    type: 'voice' | 'video'
    offer?: RTCSessionDescriptionInit
    answer?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidate
}

export function callSocketHandler(
    io: Server,
    socket: Socket,
    userSockets: Map<string, string>
) {
    const userId = socket.data.userId

    // Initiate a call
    socket.on('call:initiate', (data: CallData) => {
        const targetSocketId = userSockets.get(data.to)

        if (targetSocketId) {
            io.to(targetSocketId).emit('call:incoming', {
                from: userId,
                type: data.type,
                offer: data.offer
            })
        } else {
            socket.emit('call:user-offline', { userId: data.to })
        }
    })

    // Accept a call
    socket.on('call:accept', (data: CallData) => {
        const targetSocketId = userSockets.get(data.to)

        if (targetSocketId) {
            io.to(targetSocketId).emit('call:accepted', {
                from: userId,
                answer: data.answer
            })
        }
    })

    // Reject a call
    socket.on('call:reject', (data: { to: string, reason?: string }) => {
        const targetSocketId = userSockets.get(data.to)

        if (targetSocketId) {
            io.to(targetSocketId).emit('call:rejected', {
                from: userId,
                reason: data.reason
            })
        }
    })

    // End a call
    socket.on('call:end', (data: { to: string }) => {
        const targetSocketId = userSockets.get(data.to)

        if (targetSocketId) {
            io.to(targetSocketId).emit('call:ended', { from: userId })
        }
    })

    // ICE candidate exchange
    socket.on('call:ice-candidate', (data: CallData) => {
        const targetSocketId = userSockets.get(data.to)

        if (targetSocketId) {
            io.to(targetSocketId).emit('call:ice-candidate', {
                from: userId,
                candidate: data.candidate
            })
        }
    })

    // Toggle media (mute/camera)
    socket.on('call:toggle-media', (data: {
        to: string
        mediaType: 'audio' | 'video'
        enabled: boolean
    }) => {
        const targetSocketId = userSockets.get(data.to)

        if (targetSocketId) {
            io.to(targetSocketId).emit('call:media-toggled', {
                from: userId,
                ...data
            })
        }
    })

    // Group call - join room
    socket.on('call:join-room', (data: { roomId: string }) => {
        socket.join(`call:${data.roomId}`)
        socket.to(`call:${data.roomId}`).emit('call:user-joined', { userId })
    })

    // Group call - leave room
    socket.on('call:leave-room', (data: { roomId: string }) => {
        socket.leave(`call:${data.roomId}`)
        socket.to(`call:${data.roomId}`).emit('call:user-left', { userId })
    })

    // Group call - broadcast signal
    socket.on('call:signal', (data: { roomId: string, signal: any, to: string }) => {
        const targetSocketId = userSockets.get(data.to)

        if (targetSocketId) {
            io.to(targetSocketId).emit('call:signal', {
                from: userId,
                signal: data.signal
            })
        }
    })
}
