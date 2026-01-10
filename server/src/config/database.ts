import { config } from './env.js'
import mongoose from 'mongoose'

export async function connectMongoDB() {
    const uri = config.mongodbUri

    if (!uri) {
        console.warn('⚠️ MONGODB_URI not set, skipping MongoDB connection')
        return
    }

    try {
        await mongoose.connect(uri)
        console.log('✅ Connected to MongoDB Atlas')

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err)
        })

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected')
        })

    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error)
        throw error
    }
}

export default mongoose
