import { useAuthStore } from '@/stores/authStore'
import { mockCurrentUser } from '@/data/mockData'

/**
 * Mock auth utilities – bypass Supabase for frontend-only development.
 * Replace with real auth when backend is ready.
 */
export function useMockAuth() {
    const { setUser, setAccessToken, logout: storeLogout } = useAuthStore()

    /** Log in with mock user (any credentials accepted) */
    const mockLogin = () => {
        setUser(mockCurrentUser)
        setAccessToken('mock-access-token-' + Date.now())
    }

    /** Clear auth state */
    const mockLogout = () => {
        storeLogout()
    }

    return { mockLogin, mockLogout }
}
