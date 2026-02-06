import mongoose, { Schema, Document, Types } from 'mongoose'

// ==================== MESSAGE MODEL ====================
// Lưu trữ tin nhắn trong cuộc hội thoại

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice'

export interface IMessage extends Document {
    conversationId: Types.ObjectId
    senderId: string            // supabaseId của người gửi
    type: MessageType
    content: {
        text?: string             // Nội dung text
        mediaUrl?: string         // URL của media (image, video, file)
        thumbnail?: string        // Thumbnail cho video
        fileName?: string         // Tên file
        fileSize?: number         // Kích thước file (bytes)
        duration?: number         // Thời lượng (voice, video)
    }
    replyTo?: Types.ObjectId    // ID tin nhắn được reply
    reactions: {
        userId: string
        emoji: string
    }[]
    readBy: {
        userId: string
        readAt: Date
    }[]
    isDeleted: boolean
    createdAt: Date
}

const messageSchema = new Schema<IMessage>({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
        index: true
    },
    senderId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'file', 'sticker', 'voice'],
        default: 'text',
        required: true
    },
    content: {
        text: { type: String, maxlength: 5000 },
        mediaUrl: String,
        thumbnail: String,
        fileName: String,
        fileSize: Number,
        duration: Number
    },
    replyTo: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    },
    reactions: [{
        userId: { type: String, required: true },
        emoji: { type: String, required: true }
    }],
    readBy: [{
        userId: { type: String, required: true },
        readAt: { type: Date, default: Date.now }
    }],
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

// Index để query tin nhắn theo thời gian
messageSchema.index({ conversationId: 1, createdAt: -1 })

export const Message = mongoose.model<IMessage>('Message', messageSchema)
