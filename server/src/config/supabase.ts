import { config } from '../config/env.js'
import { createClient } from '@supabase/supabase-js'

// Admin client with service key (for server-side operations)
export const supabaseAdmin = createClient(
    config.supabaseUrl,
    config.supabaseServiceKey || config.supabaseAnonKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

// Create a client for specific user (for RLS)
export function getSupabaseClient(accessToken: string) {
    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    })
}

export default supabaseAdmin
