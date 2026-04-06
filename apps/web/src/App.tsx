import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ToastProvider } from '@/contexts/ToastContext'

// Pages
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ChatLayout from '@/pages/ChatLayout'
import ChatRoom from '@/pages/ChatRoom'
import Moments from '@/pages/Moments'
import Profile from '@/pages/Profile'
import Settings from '@/pages/Settings'

// Loading component
function LoadingScreen() {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-dark-100">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600 dark:text-gray-400">Đang tải...</p>
            </div>
        </div>
    )
}

// Auth guard component
function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore()

    if (isLoading) {
        return <LoadingScreen />
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthStore()

    if (isLoading) {
        return <LoadingScreen />
    }

    if (user) {
        return <Navigate to="/chat" replace />
    }

    return <>{children}</>
}

export default function App() {
    const { isLoading, initialized } = useAuthStore()

    // NOTE: Supabase auth listener disabled for mock mode.
    // Uncomment and restore when backend is ready:
    // useEffect(() => {
    //     const { data: { subscription } } = supabase.auth.onAuthStateChange(...)
    //     return () => subscription.unsubscribe()
    // }, [])

    // Show loading only if not initialized yet (first load before rehydration)
    if (isLoading && !initialized) {
        return <LoadingScreen />
    }

    return (
        <ToastProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    } />
                    <Route path="/register" element={
                        <PublicRoute>
                            <Register />
                        </PublicRoute>
                    } />
                    <Route path="/forgot-password" element={
                        <PublicRoute>
                            <ForgotPassword />
                        </PublicRoute>
                    } />

                    {/* Protected routes */}
                    <Route path="/chat" element={
                        <PrivateRoute>
                            <ChatLayout />
                        </PrivateRoute>
                    }>
                        <Route index element={
                            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-dark-100">
                                <div className="text-center">
                                    <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                        <svg className="w-12 h-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                        Chào mừng đến Zalo Faker
                                    </h2>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Chọn một cuộc trò chuyện để bắt đầu
                                    </p>
                                </div>
                            </div>
                        } />
                        <Route path="moments" element={<Moments />} />
                        <Route path=":conversationId" element={<ChatRoom />} />
                    </Route>

                    <Route path="/profile" element={
                        <PrivateRoute>
                            <Profile />
                        </PrivateRoute>
                    } />

                    <Route path="/settings" element={
                        <PrivateRoute>
                            <Settings />
                        </PrivateRoute>
                    } />

                    {/* Landing page (public) */}
                    <Route path="/" element={
                        <PublicRoute>
                            <Landing />
                        </PublicRoute>
                    } />

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/chat" replace />} />
                </Routes>
            </BrowserRouter>
        </ToastProvider>
    )
}
