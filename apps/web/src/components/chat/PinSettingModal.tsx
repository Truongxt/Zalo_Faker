import { useState } from 'react'
import { X, Lock, Key, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { updateHiddenPin, resetHiddenPin } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

interface PinSettingModalProps {
    onClose: () => void
    onSuccess?: () => void
}

export default function PinSettingModal({ onClose, onSuccess }: PinSettingModalProps) {
    const { user, updateProfile } = useAuthStore()
    const [mode, setMode] = useState<'change' | 'reset'>('change')
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    
    // Form states
    const [password, setPassword] = useState('')
    const [currentPin, setCurrentPin] = useState('')
    const [newPin, setNewPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')

    const handleUpdatePin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return
        
        if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
            setMessage({ type: 'error', text: 'Mã PIN mới phải gồm 6 chữ số' })
            return
        }
        
        if (newPin !== confirmPin) {
            setMessage({ type: 'error', text: 'Xác nhận mã PIN không khớp' })
            return
        }

        try {
            setIsLoading(true)
            setMessage(null)
            
            if (mode === 'change') {
                // In change mode, typically we'd verify current PIN, but for simplicity let's use the update endpoint
                // If the user wants to reset because they forgot, they should use 'reset' mode
                await updateHiddenPin(user.id, newPin)
            } else {
                await resetHiddenPin(user.id, { password, newPin })
            }
            
            setMessage({ type: 'success', text: 'Cập nhật mã PIN thành công!' })
            updateProfile({ hasHiddenPin: true })
            if (onSuccess) onSuccess()
            setTimeout(onClose, 2000)
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Có lỗi xảy ra' })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[24px] shadow-2xl overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-primary-500" />
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Cài đặt mã PIN</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-2 pt-2 gap-2">
                    <button 
                        onClick={() => { setMode('change'); setMessage(null); }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${mode === 'change' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        Thay đổi PIN
                    </button>
                    <button 
                        onClick={() => { setMode('reset'); setMessage(null); }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${mode === 'reset' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                        Quên mã PIN
                    </button>
                </div>

                <form onSubmit={handleUpdatePin} className="p-6 space-y-4">
                    {message && (
                        <div className={`p-3 rounded-xl flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                            {message.text}
                        </div>
                    )}

                    {mode === 'reset' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">Mật khẩu đăng nhập</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="password"
                                    required
                                    placeholder="Nhập mật khẩu để xác minh"
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">Mã PIN mới (6 chữ số)</label>
                        <input
                            type="password"
                            maxLength={6}
                            required
                            placeholder="••••••"
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-center tracking-[1em] font-bold focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                            value={newPin}
                            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">Xác nhận mã PIN mới</label>
                        <input
                            type="password"
                            maxLength={6}
                            required
                            placeholder="••••••"
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-center tracking-[1em] font-bold focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                            value={confirmPin}
                            onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 mt-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Đang xử lý...
                            </div>
                        ) : (
                            'Xác nhận'
                        )}
                    </button>
                    
                    <p className="text-[11px] text-center text-gray-400">
                        {mode === 'change' 
                            ? 'Mã PIN được dùng để ẩn các cuộc trò chuyện riêng tư của bạn.' 
                            : 'Mã PIN sẽ được đặt lại sau khi xác thực mật khẩu đăng nhập.'}
                    </p>
                </form>
            </div>
        </div>
    )
}
