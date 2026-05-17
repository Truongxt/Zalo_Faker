import { useState, useEffect, useMemo, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Loader2, KeyRound } from 'lucide-react'
import { authService } from '@/services/auth'
import { useToast } from '@/contexts/ToastContext'

type ForgotStep = 'request' | 'verify' | 'reset' | 'done'

const RESEND_COOLDOWN_SECONDS = 60

const steps = [
    { id: 'request', label: 'Email', description: 'Nhận OTP' },
    { id: 'verify', label: 'OTP', description: 'Xác thực' },
    { id: 'reset', label: 'Mật khẩu', description: 'Đặt lại' },
] as const

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}

export default function ForgotPassword() {
    const navigate = useNavigate()
    const { addToast } = useToast()

    const [step, setStep] = useState<ForgotStep>('request')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [resendCountdown, setResendCountdown] = useState(0)
    const [otpExpiresIn, setOtpExpiresIn] = useState<number | null>(null)
    const [error, setError] = useState('')

    const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

    useEffect(() => {
        if (resendCountdown <= 0) return

        const timer = setTimeout(() => {
            setResendCountdown((current) => Math.max(0, current - 1))
        }, 1000)

        return () => clearTimeout(timer)
    }, [resendCountdown])

    const requestOtp = async () => {
        if (!normalizedEmail) {
            setError('Vui lòng nhập email')
            return
        }

        setError('')
        setIsLoading(true)
        try {
            const result = await authService.requestForgotPasswordOtp(normalizedEmail)
            setOtp('')
            setStep('verify')
            setResendCountdown(RESEND_COOLDOWN_SECONDS)
            setOtpExpiresIn(result.expiresIn)
            addToast('Kiểm tra hộp thư để lấy mã xác thực.', 'success')
        } catch (error) {
            setError(getErrorMessage(error, 'Không thể gửi OTP'))
        } finally {
            setIsLoading(false)
        }
    }

    const verifyOtp = async () => {
        if (!normalizedEmail) {
            setError('Vui lòng nhập email')
            return
        }
        if (!otp.trim()) {
            setError('Vui lòng nhập OTP')
            return
        }

        setError('')
        setIsLoading(true)
        try {
            await authService.verifyForgotPasswordOtp(normalizedEmail, otp.trim())
            setStep('reset')
            addToast('Bạn có thể đặt lại mật khẩu ngay bây giờ.', 'success')
        } catch (error) {
            setError(getErrorMessage(error, 'Xác thực OTP thất bại'))
        } finally {
            setIsLoading(false)
        }
    }

    const resetPassword = async () => {
        if (!normalizedEmail) {
            setError('Vui lòng nhập email')
            return
        }
        if (!newPassword.trim()) {
            setError('Vui lòng nhập mật khẩu mới')
            return
        }
        if (newPassword.length < 8) {
            setError('Mật khẩu phải có ít nhất 8 ký tự')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp')
            return
        }

        setError('')
        setIsLoading(true)
        try {
            await authService.resetForgotPassword(normalizedEmail, newPassword)
            setStep('done')
            addToast('Mật khẩu đã được đặt lại thành công.', 'success')
        } catch (error) {
            setError(getErrorMessage(error, 'Không thể đặt lại mật khẩu'))
        } finally {
            setIsLoading(false)
        }
    }

    const handlePrimaryAction = (e: FormEvent) => {
        e.preventDefault();
        if (step === 'request') {
            void requestOtp()
            return
        }

        if (step === 'verify') {
            void verifyOtp()
            return
        }

        if (step === 'reset') {
            void resetPassword()
        }
    }

    const currentStepIndex = step === 'request' ? 0 : step === 'verify' ? 1 : step === 'reset' ? 2 : 3

    const title = step === 'request'
        ? 'Quên mật khẩu'
        : step === 'verify'
            ? 'Xác thực OTP'
            : step === 'reset'
                ? 'Đặt mật khẩu mới'
                : 'Hoàn tất'

    const subtitle = step === 'request'
        ? 'Nhập email để nhận mã OTP'
        : step === 'verify'
            ? 'Nhập mã đã gửi vào email của bạn'
            : step === 'reset'
                ? 'Tạo mật khẩu mới cho tài khoản'
                : 'Bạn đã có thể đăng nhập lại'

    return (
        <div className="min-h-screen flex">
            {/* Left side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
                <div className="max-w-md text-white text-center flex flex-col items-center">
                    <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm mb-8 shadow-xl">
                        <KeyRound className="w-12 h-12 text-white" />
                    </div>
                    
                    <h2 className="text-4xl font-bold mb-6 leading-tight">
                        {title}
                    </h2>

                    <p className="text-lg text-white/80 mb-8 max-w-sm">
                        {subtitle}
                    </p>
                </div>
            </div>

            {/* Right side - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-100">
                <div className="w-full max-w-md">
                    {/* Mobile branding */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center">
                                <MessageCircle className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">taklo</h1>
                        </div>
                    </div>

                    <div className="card p-8">
                        <Link to="/login" className="inline-block text-primary-500 hover:text-primary-600 mb-6 font-medium text-sm flex items-center gap-1">
                            &larr; Quay lại
                        </Link>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {title}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8">
                            {subtitle}
                        </p>

                        <div className="bg-gray-100 dark:bg-dark-300 rounded-2xl p-3 flex items-center justify-between mb-8">
                            {steps.map((item, index) => {
                                const isActive = index === currentStepIndex
                                const isDone = index < currentStepIndex
                                const isFaded = !isActive && !isDone
                                
                                return (
                                    <div key={item.id} className={`flex-1 flex flex-col items-center ${isFaded ? 'opacity-50' : 'opacity-100'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2
                                            ${isActive || isDone ? 'bg-primary-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                                            {index + 1}
                                        </div>
                                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{item.label}</span>
                                    </div>
                                )
                            })}
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handlePrimaryAction} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input"
                                    placeholder="example@email.com"
                                    required
                                    disabled={step === 'done'}
                                />
                            </div>

                            {step !== 'request' && step !== 'done' && (
                                <div className="animate-fade-in">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">
                                        Mã OTP
                                    </label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="input tracking-widest text-center"
                                        placeholder="••• •••"
                                        maxLength={6}
                                        required
                                        disabled={step !== 'verify'}
                                    />
                                    {step === 'verify' && (
                                        <div className="flex justify-between mt-2">
                                            {otpExpiresIn ? (
                                                <span className="text-xs text-primary-600 dark:text-primary-400">
                                                    Còn {Math.floor(otpExpiresIn / 60)}:{String(otpExpiresIn % 60).padStart(2, '0')}
                                                </span>
                                            ) : <span />}
                                            
                                            <button 
                                                type="button" 
                                                onClick={() => { if (resendCountdown === 0) requestOtp() }}
                                                disabled={isLoading || resendCountdown > 0}
                                                className={`text-xs font-medium ${resendCountdown > 0 ? 'text-gray-400' : 'text-primary-500 hover:text-primary-600 cursor-pointer'}`}
                                            >
                                                {resendCountdown > 0 ? `Gửi lại sau ${resendCountdown}s` : 'Gửi lại mã OTP'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 'reset' && (
                                <div className="space-y-5 animate-fade-in mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Mật khẩu mới
                                        </label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="input"
                                            placeholder="Ít nhất 8 ký tự"
                                            required
                                            minLength={8}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Xác nhận mật khẩu
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="input"
                                            placeholder="Nhập lại mật khẩu"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {step !== 'done' ? (
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="btn-primary w-full h-12 text-base mt-8"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        step === 'request' ? 'Gửi mã xác nhận' :
                                        step === 'verify' ? 'Xác thực OTP' : 'Xác nhận'
                                    )}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="btn-primary w-full h-12 text-base mt-8"
                                >
                                    Về trang Đăng nhập
                                </button>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
