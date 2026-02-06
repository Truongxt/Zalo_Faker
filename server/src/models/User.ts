import mongoose, { Schema, Document } from 'mongoose'

// ==================== USER MODEL ====================
// Lưu thêm thông tin user ngoài Supabase Auth

export interface IUser extends Document {
    supabaseId: string      // ID từ Supabase Auth
    email: string
    fullName: string
    phone?: string
    avatarUrl?: string
    bio?: string
    status: 'online' | 'offline' | 'away'
    lastSeen?: Date
    createdAt: Date
    updatedAt: Date
}

const userSchema = new Schema<IUser>({
    supabaseId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        unique: true,
        sparse: true  // Cho phép null
    },
    avatarUrl: String,
    bio: {
        type: String,
        maxlength: 200
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'away'],
        default: 'offline'
    },
    lastSeen: Date
}, {
    timestamps: true  // Tự động thêm createdAt, updatedAt
})

export const User = mongoose.model<IUser>('User', userSchema)
