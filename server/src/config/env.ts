// This file MUST be imported first to load environment variables
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from server directory
dotenv.config({ path: resolve(__dirname, '../../.env') })

// Export config values with defaults
export const config = {
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

    // Supabase
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

    // MongoDB
    mongodbUri: process.env.MONGODB_URI || '',

    // Cloudinary
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',

    // AI
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
}

// Validate required config
export function validateConfig() {
    const missing: string[] = []

    if (!config.supabaseUrl) missing.push('SUPABASE_URL')
    if (!config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY')

    if (missing.length > 0) {
        console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`)
        console.warn('Some features may not work correctly.')
    }
}
