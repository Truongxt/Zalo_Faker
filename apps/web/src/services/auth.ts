import { supabase } from '@/lib/supabase'
import { User } from '@/stores/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export const authService = {
    async register(fullName: string, email: string, password: string): Promise<{ user: User; accessToken: string }> {
        // Register with Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName }
            }
        })

        if (authError) throw new Error(authError.message)
        if (!authData.user) throw new Error('Registration failed')

        // Create user profile in our database
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authData.session?.access_token}`
            },
            body: JSON.stringify({
                id: authData.user.id,
                email,
                fullName
            })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Failed to create profile')
        }

        const user: User = {
            id: authData.user.id,
            email: authData.user.email || null,
            phone: null,
            fullName,
            avatarUrl: null,
            bio: null,
            status: 'online',
            lastSeen: null,
            createdAt: new Date().toISOString()
        }

        return {
            user,
            accessToken: authData.session?.access_token || ''
        }
    },

    async login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (authError) throw new Error(authError.message)
        if (!authData.user || !authData.session) throw new Error('Login failed')

        // Get user profile from our database
        const response = await fetch(`${API_URL}/users/${authData.user.id}`, {
            headers: {
                'Authorization': `Bearer ${authData.session.access_token}`
            }
        })

        let user: User

        if (response.ok) {
            const userData = await response.json()
            user = {
                id: authData.user.id,
                email: authData.user.email || null,
                phone: userData.phone || null,
                fullName: userData.fullName || authData.user.user_metadata?.full_name || 'User',
                avatarUrl: userData.avatarUrl || null,
                bio: userData.bio || null,
                status: 'online',
                lastSeen: null,
                createdAt: userData.createdAt || new Date().toISOString()
            }
        } else {
            // Fallback to Supabase user data
            user = {
                id: authData.user.id,
                email: authData.user.email || null,
                phone: authData.user.phone || null,
                fullName: authData.user.user_metadata?.full_name || 'User',
                avatarUrl: authData.user.user_metadata?.avatar_url || null,
                bio: null,
                status: 'online',
                lastSeen: null,
                createdAt: authData.user.created_at
            }
        }

        return {
            user,
            accessToken: authData.session.access_token
        }
    },

    async loginWithGoogle(): Promise<void> {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/chat`
            }
        })

        if (error) throw new Error(error.message)
    },

    async logout(): Promise<void> {
        const { error } = await supabase.auth.signOut()
        if (error) throw new Error(error.message)
    },

    async updateProfile(updates: { fullName?: string; bio?: string; avatarUrl?: string }): Promise<void> {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        const response = await fetch(`${API_URL}/users/${session.user.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(updates)
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Failed to update profile')
        }
    },

    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw new Error(error.message)
        return session
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
        return supabase.auth.onAuthStateChange(callback)
    }
}

export default authService
