import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/auth'
import { useToast } from '@/contexts/ToastContext'

export default function LockAccount() {
    const navigate = useNavigate()
    const { user, logout } = useAuthStore()
    const { addToast } = useToast()

    const [password, setPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleLock = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!user?.id && !user?.userId) {
            addToast('Không tìm thấy tài khoản', 'error')
            return
        }

        if (!password.trim()) {
            addToast('Vui lòng nhập mật khẩu hiện tại', 'error')
            return
        }

        const confirmed = window.confirm('Bạn chắc chắn muốn khóa tài khoản? Bạn có thể mở khóa lại sau.')
        if (!confirmed) return

        setIsSubmitting(true)
        try {
            const userId = user.id || user.userId!
            const result = await authService.lockAccount(userId, password)
            addToast(result.message || 'Khóa tài khoản thành công', 'success')
            await authService.logout()
            logout()
            navigate('/login')
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Khóa tài khoản thất bại', 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-100">
            <div className="bg-white dark:bg-dark-200 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => navigate('/settings')} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-lg">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Khóa tài khoản</h1>
                </div>
            </div>

            <form onSubmit={handleLock} className="max-w-lg mx-auto p-4">
                <div className="card p-4 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Tài khoản sẽ tạm khóa, bạn có thể đăng nhập để mở khóa lại.
                    </p>
                    <label className="block">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Mật khẩu hiện tại</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 w-full px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Xác nhận khóa tài khoản
                    </button>
                </div>
            </form>
        </div>
    )
}
