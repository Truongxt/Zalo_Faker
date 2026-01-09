import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { authService } from '@/services/auth'
import {
    ArrowLeft,
    Camera,
    Edit2,
    Mail,
    Phone,
    Calendar,
    QrCode,
    Settings,
    LogOut,
    Loader2
} from 'lucide-react'

export default function Profile() {
    const navigate = useNavigate()
    const { user, updateProfile, logout } = useAuthStore()

    const [isEditing, setIsEditing] = useState(false)
    const [fullName, setFullName] = useState(user?.fullName || '')
    const [bio, setBio] = useState(user?.bio || '')
    const [isLoading, setIsLoading] = useState(false)

    const handleSave = async () => {
        if (!user) return
        setIsLoading(true)

        try {
            await authService.updateProfile({ fullName, bio })
            updateProfile({ fullName, bio })
            setIsEditing(false)
        } catch (error) {
            console.error('Failed to update profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleLogout = async () => {
        await authService.logout()
        logout()
        navigate('/login')
    }

    if (!user) return null

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-100">
            {/* Header */}
            <div className="gradient-primary">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <div className="flex items-center justify-between text-white">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 hover:bg-white/10 rounded-lg"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-semibold">Trang cá nhân</h1>
                        <button
                            onClick={() => navigate('/settings')}
                            className="p-2 -mr-2 hover:bg-white/10 rounded-lg"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Profile card */}
                <div className="max-w-lg mx-auto px-4 pb-20">
                    <div className="relative flex flex-col items-center">
                        {/* Avatar */}
                        <div className="relative">
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt={user.fullName}
                                    className="w-28 h-28 rounded-full border-4 border-white object-cover"
                                />
                            ) : (
                                <div className="w-28 h-28 rounded-full border-4 border-white bg-primary-100 flex items-center justify-center">
                                    <span className="text-4xl font-bold text-primary-600">
                                        {user.fullName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <button className="absolute bottom-0 right-0 p-2 bg-primary-500 text-white rounded-full shadow-lg hover:bg-primary-600">
                                <Camera className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Name */}
                        <h2 className="mt-4 text-2xl font-bold text-white">{user.fullName}</h2>
                        {user.bio && (
                            <p className="text-white/80 mt-1">{user.bio}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-lg mx-auto px-4 -mt-12">
                <div className="card space-y-1">
                    {/* Quick actions */}
                    <div className="grid grid-cols-3 gap-4 py-4 border-b border-gray-200 dark:border-gray-700">
                        <button className="flex flex-col items-center gap-2 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-300">
                            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <QrCode className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Mã QR</span>
                        </button>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex flex-col items-center gap-2 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-300"
                        >
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Edit2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Sửa hồ sơ</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex flex-col items-center gap-2 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-300"
                        >
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <LogOut className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Đăng xuất</span>
                        </button>
                    </div>

                    {/* Info */}
                    <div className="py-2">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 px-4 py-2">
                            Thông tin cá nhân
                        </h3>

                        <div className="space-y-1">
                            {user.email && (
                                <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-300 rounded-lg">
                                    <Mail className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                                        <p className="text-gray-900 dark:text-white">{user.email}</p>
                                    </div>
                                </div>
                            )}

                            {user.phone && (
                                <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-300 rounded-lg">
                                    <Phone className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Số điện thoại</p>
                                        <p className="text-gray-900 dark:text-white">{user.phone}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-300 rounded-lg">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Ngày tham gia</p>
                                    <p className="text-gray-900 dark:text-white">
                                        {new Date(user.createdAt).toLocaleDateString('vi-VN', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit modal */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="card w-full max-w-md p-6 animate-scale-in">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Chỉnh sửa hồ sơ
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Họ và tên
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Giới thiệu
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    rows={3}
                                    className="input resize-none"
                                    placeholder="Viết vài dòng về bản thân..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="btn-secondary flex-1"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="btn-primary flex-1"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
