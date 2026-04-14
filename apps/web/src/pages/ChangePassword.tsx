import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/auth'
import { useToast } from '@/contexts/ToastContext'

export default function ChangePassword() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { addToast } = useToast()

    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showOldPassword, setShowOldPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!user?.id && !user?.userId) {
            addToast('Không tìm thấy tài khoản', 'error')
            return
        }

        if (!oldPassword.trim()) {
            addToast('Vui lòng nhập mật khẩu cũ', 'error')
            return
        }

        if (!newPassword.trim() || newPassword.length < 6) {
            addToast('Mật khẩu mới phải từ 6 ký tự', 'error')
            return
        }

        if (oldPassword === newPassword) {
            addToast('Mật khẩu mới phải khác mật khẩu cũ', 'error')
            return
        }

        if (newPassword !== confirmPassword) {
            addToast('Mật khẩu xác nhận không khớp', 'error')
            return
        }

        setIsSubmitting(true)
        try {
            const userId = user.id || user.userId!
            const result = await authService.changePassword(userId, oldPassword, newPassword)
            addToast(result.message || 'Đổi mật khẩu thành công', 'success')
            navigate('/settings')
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Đổi mật khẩu thất bại', 'error')
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
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Đổi mật khẩu</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-4">
                <div className="card p-4 space-y-4">
                    <InputPassword
                        label="Mật khẩu cũ"
                        value={oldPassword}
                        onChange={setOldPassword}
                        visible={showOldPassword}
                        onToggle={() => setShowOldPassword((prev) => !prev)}
                    />

                    <InputPassword
                        label="Mật khẩu mới"
                        value={newPassword}
                        onChange={setNewPassword}
                        visible={showNewPassword}
                        onToggle={() => setShowNewPassword((prev) => !prev)}
                    />

                    <InputPassword
                        label="Xác nhận mật khẩu mới"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        visible={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword((prev) => !prev)}
                    />

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Cập nhật mật khẩu
                    </button>
                </div>
            </form>
        </div>
    )
}

type InputPasswordProps = {
    label: string
    value: string
    onChange: (value: string) => void
    visible: boolean
    onToggle: () => void
}

function InputPassword({ label, value, onChange, visible, onToggle }: InputPasswordProps) {
    return (
        <label className="block">
            <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
            <div className="mt-1 flex items-center bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full py-3 bg-transparent outline-none text-gray-900 dark:text-white"
                />
                <button type="button" onClick={onToggle} className="text-gray-500">
                    {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        </label>
    )
}
