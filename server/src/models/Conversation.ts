import mongoose, { Schema, Document, Types } from 'mongoose'

// ==================== CONVERSATION MODEL ====================
// Lưu trữ thông tin cuộc hội thoại (private chat hoặc group)

export type ConversationType = 'private' | 'group'
export type ParticipantRole = 'admin' | 'member'

export interface IParticipant {
    userId: string              // supabaseId
    role: ParticipantRole
    nickname?: string           // Biệt danh trong nhóm
    joinedAt: Date
    lastRead?: Date             // Thời điểm đọc tin nhắn cuối
}

export interface IConversation extends Document {
    type: ConversationType
    name?: string               // Tên nhóm (chỉ cho group)
    avatar?: string             // Avatar nhóm
    participants: IParticipant[]
    lastMessage?: {
        content: string
        type: string
        senderId: string
        timestamp: Date
    }
    createdBy: string           // supabaseId người tạo
    createdAt: Date
    updatedAt: Date
}

const conversationSchema = new Schema<IConversation>({
    type: {
        type: String,
        enum: ['private', 'group'],
        required: true
    },
    name: {
        type: String,
        maxlength: 100
    },
    avatar: String,
    participants: [{
        userId: { type: String, required: true },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member'
        },
        nickname: { type: String, maxlength: 50 },
        joinedAt: { type: Date, default: Date.now },
        lastRead: Date
    }],
    lastMessage: {
        content: String,
        type: String,
        senderId: String,
        timestamp: Date
    },
    createdBy: {
        type: String,
        required: true
    }
}, {
    timestamps: true
})

// Index để tìm conversations của user
conversationSchema.index({ 'participants.userId': 1 })
conversationSchema.index({ updatedAt: -1 })

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema)
