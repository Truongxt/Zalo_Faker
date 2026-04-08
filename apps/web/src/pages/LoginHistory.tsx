import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { authService, type LoginHistoryItem } from '@/services/auth'
import { useToast } from '@/contexts/ToastContext'

const platformLabel = (platform: string) => {
    if (platform === 'mobile') return 'Di động'
    if (platform === 'web') return 'Trình duyệt'
    return 'Không xác định'
}

const formatDate = (value: string) => {
    const d = new Date(value)
    return d.toLocaleString('vi-VN')
}

export default function LoginHistory() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { addToast } = useToast()

    const [history, setHistory] = useState<LoginHistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const fetchHistory = useCallback(async () => {
        if (!user?.id && !user?.userId) return
        const userId = user?.id || user?.userId!
        const data = await authService.getLoginHistory(userId, 50)
        setHistory(data)
    }, [user?.id, user?.userId])

    useEffect(() => {
        setIsLoading(true)
        fetchHistory()
            .catch((error) => addToast(error instanceof Error ? error.message : 'Không tải được lịch sử', 'error'))
            .finally(() => setIsLoading(false))
    }, [fetchHistory, addToast])

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            await fetchHistory()
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Làm mới thất bại', 'error')
        } finally {
            setIsRefreshing(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-100">
            <div className="bg-white dark:bg-dark-200 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/settings')} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Lịch sử đăng nhập</h1>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-dark-300 hover:bg-gray-200 dark:hover:bg-dark-400"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Làm mới
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4">
                {isLoading ? (
                    <div className="card p-8 flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Đang tải...
                    </div>
                ) : history.length === 0 ? (
                    <div className="card p-8 text-center text-gray-500">Chưa có lịch sử đăng nhập</div>
                ) : (
                    <div className="space-y-3">
                        {history.map((item, index) => (
                            <div key={item.loginId} className="card p-4">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {platformLabel(item.platform)} {index === 0 ? '(Gần nhất)' : ''}
                                    </p>
                                    <p className="text-xs text-gray-500">{formatDate(item.loginAt)}</p>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Thiết bị: {item.deviceInfo || 'Không xác định'}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">IP: {item.ipAddress || 'Không xác định'}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
