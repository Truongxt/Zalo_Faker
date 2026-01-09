import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

    // Actions
    setUser: (user: User | null) => void
    setAccessToken: (token: string | null) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    logout: () => void
    updateProfile: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isLoading: true,
            error: null,

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
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken
            }),
        }
    )
)
