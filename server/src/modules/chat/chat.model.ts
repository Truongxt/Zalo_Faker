import mongoose, { Schema, Document } from 'mongoose'

// Message Schema
export interface IMessage extends Document {
    conversationId: mongoose.Types.ObjectId
    senderId: string
    type: 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice'
    content: {
        text?: string
        mediaUrl?: string
        thumbnail?: string
        fileName?: string
        fileSize?: number
        duration?: number
    }
    replyTo?: mongoose.Types.ObjectId
    reactions: { userId: string; emoji: string }[]
    readBy: { userId: string; readAt: Date }[]
    isDeleted: boolean
    createdAt: Date
    updatedAt: Date
}

const messageSchema = new Schema<IMessage>({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
        index: true
    },
    senderId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'file', 'sticker', 'voice'],
        default: 'text'
    },
    content: {
        text: String,
        mediaUrl: String,
        thumbnail: String,
        fileName: String,
        fileSize: Number,
        duration: Number
    },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: [{
        userId: String,
        emoji: String
    }],
    readBy: [{
        userId: String,
        readAt: Date
    }],
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true })

// Indexes for common queries
messageSchema.index({ conversationId: 1, createdAt: -1 })
messageSchema.index({ senderId: 1, createdAt: -1 })

// Conversation Schema
export interface IConversation extends Document {
    type: 'private' | 'group'
    name?: string
    avatar?: string
    participants: {
        userId: string
        role: 'admin' | 'member'
        joinedAt: Date
        lastRead?: Date
    }[]
    lastMessage?: {
        content: string
        type: string
        senderId: string
        timestamp: Date
    }
    createdAt: Date
    updatedAt: Date
}

const conversationSchema = new Schema<IConversation>({
    type: {
        type: String,
        enum: ['private', 'group'],
        required: true
    },
    name: String,
    avatar: String,
    participants: [{
        userId: { type: String, required: true },
        role: { type: String, enum: ['admin', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        lastRead: Date
    }],
    lastMessage: {
        content: String,
        type: String,
        senderId: String,
        timestamp: Date
    }
}, { timestamps: true })

// Index for finding conversations by participant
conversationSchema.index({ 'participants.userId': 1 })

export const Message = mongoose.model<IMessage>('Message', messageSchema)
export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema)
