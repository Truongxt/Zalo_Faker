import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

export interface User {
    id: string
    email: string | null
    phone: string | null
    fullName: string
    avatarUrl: string | null
    bio: string | null
    status: 'online' | 'offline' | 'away'
    lastSeen: string | null
    createdAt: string
}

interface AuthState {
    user: User | null
    accessToken: string | null
    isLoading: boolean
    error: string | null
    initialized: boolean

    // Actions
    setUser: (user: User | null) => void
    setAccessToken: (token: string | null) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    logout: () => void
    updateProfile: (updates: Partial<User>) => void
    initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            isLoading: true,
            error: null,
            initialized: false,

            setUser: (user) => set({ user, isLoading: false }),

            setAccessToken: (accessToken) => set({ accessToken }),

            setLoading: (isLoading) => set({ isLoading }),

            setError: (error) => set({ error, isLoading: false }),

            logout: () => set({
                user: null,
                accessToken: null,
                isLoading: false,
                error: null
            }),

            updateProfile: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null
            })),

            // Initialize auth state on app load
            initialize: async () => {
                if (get().initialized) return

                try {
                    const { data: { session } } = await supabase.auth.getSession()

                    if (session?.user) {
                        const user: User = {
                            id: session.user.id,
                            email: session.user.email || null,
                            phone: session.user.phone || null,
                            fullName: session.user.user_metadata?.full_name || 'User',
                            avatarUrl: session.user.user_metadata?.avatar_url || null,
                            bio: session.user.user_metadata?.bio || null,
                            status: 'online',
                            lastSeen: null,
                            createdAt: session.user.created_at
                        }
                        set({
                            user,
                            accessToken: session.access_token,
                            isLoading: false,
                            initialized: true
                        })
                    } else {
                        set({
                            user: null,
                            accessToken: null,
                            isLoading: false,
                            initialized: true
                        })
                    }
                } catch (error) {
                    console.error('Auth initialization error:', error)
                    set({
                        isLoading: false,
                        initialized: true
                    })
                }
            }
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken
            }),
            onRehydrateStorage: () => (state) => {
                // After rehydrating from localStorage, set loading to false
                if (state) {
                    state.isLoading = false
                    state.initialized = true
                }
            }
        }
    )
)
