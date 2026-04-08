import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, LockKeyhole, ArrowLeft } from 'lucide-react'
import { authService } from '@/services/auth'

export default function UnlockAccount() {
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleUnlock = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (!email.trim()) {
            setError('Vui lòng nhập email')
            return
        }
        if (!password.trim()) {
            setError('Vui lòng nhập mật khẩu')
            return
        }

        setIsLoading(true)
        try {
            const result = await authService.unlockAccount(email.trim().toLowerCase(), password)
            setSuccess(result.message || 'Mở khóa tài khoản thành công')
        } catch (err: any) {
            setError(err?.message || 'Mở khóa tài khoản thất bại')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-100">
            <div className="w-full max-w-md card p-8">
                <button
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
                </button>

                <div className="text-center mb-6">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-4">
                        <LockKeyhole className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mở khóa tài khoản</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Nhập đúng email và mật khẩu để mở khóa
                    </p>
                </div>

                {error ? (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
                ) : null}

                {success ? (
                    <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">{success}</div>
                ) : null}

                <form onSubmit={handleUnlock} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input"
                            placeholder="example@email.com"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mật khẩu</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input pr-12"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                        Mở khóa tài khoản
                    </button>
                </form>

                <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
                    Sau khi mở khóa xong, quay về <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">đăng nhập</Link>
                </p>
            </div>
        </div>
    )
}
