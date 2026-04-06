import React, { useState } from 'react'
import { X, Search, UserPlus, Phone, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getUserByPhone } from '@/services/api'
import { friendsService } from '@/services/friendsService'
import { useAuthStore, User } from '@/stores/authStore'
import { useToast } from '@/contexts/ToastContext'

interface AddFriendModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function AddFriendModal({ isOpen, onClose }: AddFriendModalProps) {
    const { user: currentUser } = useAuthStore()
    const { addToast } = useToast()
    const [phoneNumber, setPhoneNumber] = useState('')
    const [searchResult, setSearchResult] = useState<User | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [requestMessage, setRequestMessage] = useState('')
    const [isRequestSent, setIsRequestSent] = useState(false)

    if (!isOpen) return null

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phoneNumber.trim()) return

        setLoading(true)
        setError(null)
        setSearchResult(null)
        setIsRequestSent(false)

        try {
            const result = await getUserByPhone(phoneNumber.trim())
            if (result) {
                setSearchResult(result)
                setRequestMessage(`Xin chào, mình là ${currentUser?.fullName}, kết bạn với mình nhé!`)
            } else {
                setError('Không tìm thấy người dùng với số điện thoại này.')
            }
        } catch (err: any) {
            setError('Số điện thoại không tồn tại hoặc có lỗi xảy ra.')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSendRequest = async () => {
        if (!searchResult || !currentUser) return

        setLoading(true)
        try {
            await friendsService.sendFriendRequest(
                currentUser.id,
                searchResult.id,
                requestMessage
            )
            setIsRequestSent(true)
            addToast('Đã gửi yêu cầu kết bạn!', 'success')
        } catch (err) {
            addToast('Gửi yêu cầu thất bại. Vui lòng thử lại.', 'error')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-100 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-dark-200/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <h2 className="font-bold text-gray-900 dark:text-white">Thêm bạn mới</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Search Form */}
                    <form onSubmit={handleSearch} className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tìm kiếm bằng số điện thoại
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="Nhập số điện thoại (ví dụ: 0987654321)"
                                className="w-full pl-10 pr-24 py-3 bg-gray-100 dark:bg-dark-300 rounded-xl
                                    text-gray-900 dark:text-white placeholder-gray-500
                                    focus:outline-none focus:ring-2 focus:ring-primary-500 border-none transition-all"
                            />
                            <button
                                type="submit"
                                disabled={loading || !phoneNumber.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-1"
                            >
                                {loading ? '...' : <Search className="w-3.5 h-3.5" />}
                                Tìm
                            </button>
                        </div>
                    </form>

                    {/* Content Area */}
                    <div className="min-h-[160px] flex flex-col items-center justify-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl p-6 bg-gray-50/30 dark:bg-dark-200/20">
                        {error && (
                            <div className="text-center">
                                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 text-sm">{error}</p>
                            </div>
                        )}

                        {!searchResult && !error && !loading && (
                            <div className="text-center text-gray-400">
                                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Nhập số điện thoại để tìm bạn bè</p>
                            </div>
                        )}

                        {loading && (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
                                <p className="text-sm text-gray-500">Đang tìm kiếm...</p>
                            </div>
                        )}

                        {searchResult && !isRequestSent && (
                            <div className="w-full">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500/20">
                                        {searchResult.avatarUrl ? (
                                            <img src={searchResult.avatarUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-primary-600 text-2xl font-bold">
                                                {searchResult.fullName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                                            {searchResult.fullName}
                                        </h3>
                                        <p className="text-sm text-gray-500">{searchResult.phoneNumber}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            Lời nhắn kết bạn
                                        </label>
                                        <textarea
                                            value={requestMessage}
                                            onChange={(e) => setRequestMessage(e.target.value)}
                                            rows={2}
                                            className="w-full p-3 bg-white dark:bg-dark-300 rounded-xl border border-gray-200 dark:border-gray-700
                                                text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendRequest}
                                        disabled={loading}
                                        className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        <UserPlus className="w-5 h-5" />
                                        Gửi yêu cầu kết bạn
                                    </button>
                                </div>
                            </div>
                        )}

                        {isRequestSent && (
                            <div className="text-center">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                                    <CheckCircle2 className="w-12 h-12" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Đã gửi lời mời!</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Yêu cầu kết bạn đã được gửi đến <strong>{searchResult?.fullName}</strong>.
                                </p>
                                <button
                                    onClick={() => {
                                        setSearchResult(null)
                                        setIsRequestSent(false)
                                        setPhoneNumber('')
                                    }}
                                    className="px-6 py-2 bg-gray-100 dark:bg-dark-300 hover:bg-gray-200 dark:hover:bg-dark-400 rounded-xl text-sm font-medium transition-all"
                                >
                                    Tìm người khác
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Tips */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-dark-200/50 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] text-gray-400 text-center">
                        Bạn có thể tìm kiếm người dùng thông qua số điện thoại chính xác được đăng ký trên hệ thống.
                    </p>
                </div>
            </div>
        </div>
    )
}
