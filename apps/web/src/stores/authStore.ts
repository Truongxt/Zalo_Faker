import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
    id: string
    userId?: string
    email: string | null
    phone: string | null
    fullName: string
    userName?: string
    avatarUrl: string | null
    avartarUrl?: string | null // backend typo
    bio: string | null
    status: 'online' | 'offline' | 'away' | string
    lastSeen: string | null
    createdAt: string
}

interface AuthState {
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    isLoading: boolean
    error: string | null
    initialized: boolean

    // Actions
    setUser: (user: User | null) => void
    setAccessToken: (token: string | null) => void
    setRefreshToken: (token: string | null) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    logout: () => void
    updateProfile: (updates: Partial<User>) => void
    initialize: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: true,
            error: null,
            initialized: false,

            setUser: (user) => set({ user, isLoading: false }),

            setAccessToken: (accessToken) => set({ accessToken }),

            setRefreshToken: (refreshToken) => set({ refreshToken }),

            setLoading: (isLoading) => set({ isLoading }),

            setError: (error) => set({ error, isLoading: false }),

            logout: () => set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isLoading: false,
                error: null
            }),

            updateProfile: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null
            })),

            // Dùng để đánh dấu đã rehydrate từ localStorage
            initialize: () => {
                if (get().initialized) return
                set({
                    isLoading: false,
                    initialized: true
                })
            }
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken
            }),
            onRehydrateStorage: () => (state) => {
                // Sau khi load xong state từ localStorage thì bỏ loading
                if (state) {
                    state.isLoading = false
                    state.initialized = true
                }
            }
        }
    )
)
