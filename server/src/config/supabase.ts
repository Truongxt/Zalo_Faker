import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Admin client with service key (for server-side operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

// Create a client for specific user (for RLS)
export function getSupabaseClient(accessToken: string) {
    return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    })
}

export default supabaseAdmin
