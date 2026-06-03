import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/auth'
import { useToast } from '@/contexts/ToastContext'

export default function DeleteAccount() {
    const navigate = useNavigate()
    const { user, logout } = useAuthStore()
    const { addToast } = useToast()
    const accountEmail = user?.email || 'email tài khoản của bạn'

    const [password, setPassword] = useState('')
    const [otp, setOtp] = useState('')
    const [confirmIrreversible, setConfirmIrreversible] = useState(false)
    const [otpCountdown, setOtpCountdown] = useState(0)
    const [isSendingOtp, setIsSendingOtp] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (otpCountdown <= 0) return
        const timer = setInterval(() => {
            setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0))
        }, 1000)
        return () => clearInterval(timer)
    }, [otpCountdown])

    const handleRequestOtp = async () => {
        if (!user?.id && !user?.userId) {
            addToast('Không tìm thấy tài khoản', 'error')
            return
        }
        if (otpCountdown > 0) return

        setIsSendingOtp(true)
        try {
            const userId = user!.id || user!.userId!
            await authService.requestPermanentLockOtp(userId)
            setOtpCountdown(60)
            addToast('OTP đã được gửi qua email', 'success')
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Gửi OTP thất bại', 'error')
        } finally {
            setIsSendingOtp(false)
        }
    }

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!user?.id && !user?.userId) {
            addToast('Không tìm thấy tài khoản', 'error')
            return
        }
        if (!password.trim()) {
            addToast('Vui lòng nhập mật khẩu', 'error')
            return
        }
        if (!otp.trim()) {
            addToast('Vui lòng nhập OTP', 'error')
            return
        }
        if (!confirmIrreversible) {
            addToast('Bạn cần xác nhận thao tác không thể phục hồi', 'error')
            return
        }

        const confirmed = window.confirm('Tài khoản sẽ bị xóa vĩnh viễn. Tiếp tục?')
        if (!confirmed) return

        setIsSubmitting(true)
        try {
            const userId = user.id || user.userId!
            const result = await authService.permanentLockAccount(userId, password, otp, true)
            addToast(result.message || 'Tài khoản đã bị xóa vĩnh viễn', 'success')
            await authService.logout()
            logout()
            navigate('/login')
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Xóa tài khoản thất bại', 'error')
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
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Xóa tài khoản</h1>
                </div>
            </div>

            <form onSubmit={handleDelete} className="max-w-lg mx-auto p-4" autoComplete="off">
                <div className="card p-4 space-y-4">
                    <p className="text-sm text-red-500">
                        Cảnh báo: thao tác này là vĩnh viễn và không thể khôi phục.
                    </p>

                    <div className="space-y-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Nhận mã OTP</span>
                        <div className="flex gap-2">
                            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-dark-300">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Gửi tới email</p>
                                <p className="break-all text-sm font-medium text-gray-900 dark:text-white">
                                    {accountEmail}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleRequestOtp}
                                disabled={isSendingOtp || otpCountdown > 0}
                                className="shrink-0 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm disabled:opacity-70"
                            >
                                {isSendingOtp ? 'Đang gửi...' : otpCountdown > 0 ? `Gửi lại (${otpCountdown}s)` : 'Gửi OTP'}
                            </button>
                        </div>
                    </div>

                    <label className="block">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Mã OTP xác nhận</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            name="delete-account-otp"
                            autoComplete="one-time-code"
                            spellCheck={false}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Nhập 6 số OTP"
                            className="mt-1 w-full px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Mật khẩu hiện tại</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="mt-1 w-full px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-300 text-gray-900 dark:text-white"
                        />
                    </label>

                    <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={confirmIrreversible}
                            onChange={(e) => setConfirmIrreversible(e.target.checked)}
                            className="mt-1"
                        />
                        Tôi xác nhận xóa tài khoản là vĩnh viễn và không thể phục hồi.
                    </label>

                    <button
                        type="submit"
                        disabled={isSubmitting || isSendingOtp}
                        className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Xóa tài khoản vĩnh viễn
                    </button>
                </div>
            </form>
        </div>
    )
}
