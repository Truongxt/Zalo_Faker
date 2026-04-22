import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
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
    Loader2,
    User as UserIcon,
    X
} from 'lucide-react'

export default function Profile() {
    const navigate = useNavigate()
    const { user, updateProfile, logout } = useAuthStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [isEditing, setIsEditing] = useState(false)
    const [showQrCode, setShowQrCode] = useState(false)
    const [fullName, setFullName] = useState(user?.fullName || '')
    const [phone, setPhone] = useState(user?.phone || '')
    const [birthday, setBirthday] = useState(user?.birthday || '')
    const [gender, setGender] = useState(user?.gender || 'other')
    const [bio, setBio] = useState(user?.bio || '')
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
    
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const handleSave = async () => {
        if (!user) return
        setIsLoading(true)

        try {
            const updates = { 
                fullName, 
                phone, 
                birthday, 
                gender, 
                bio,
                avatarUrl 
            }
            await authService.updateProfile(updates)
            updateProfile(updates)
            setIsEditing(false)
        } catch (error) {
            console.error('Failed to update profile:', error)
            alert('Không thể cập nhật hồ sơ. Vui lòng thử lại.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setIsUploading(true)
            const url = await authService.uploadAvatar(file)
            setAvatarUrl(url)
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Không thể tải ảnh lên.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleRemoveAvatar = () => {
        setAvatarUrl('')
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
            <div className="gradient-primary pb-24">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <div className="flex items-center justify-between text-white">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-semibold">Trang cá nhân</h1>
                        <button
                            onClick={() => navigate('/settings')}
                            className="p-2 -mr-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Profile card header */}
                <div className="max-w-lg mx-auto px-4">
                    <div className="flex flex-col items-center">
                        <div className="relative group">
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt={user.fullName}
                                    className="w-28 h-28 rounded-full border-4 border-white dark:border-dark-200 object-cover shadow-xl"
                                />
                            ) : (
                                <div className="w-28 h-28 rounded-full border-4 border-white dark:border-dark-200 bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl">
                                    <span className="text-4xl font-bold text-white">
                                        {user.fullName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="absolute bottom-0 right-0 p-2 bg-white text-primary-600 rounded-full shadow-lg hover:scale-110 transition-transform"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                        </div>

                        <h2 className="mt-4 text-2xl font-bold text-white">{user.fullName}</h2>
                        <p className="text-white/80 text-sm mt-1">{user.email}</p>
                        <p className="text-white/60 text-xs mt-1">ID: {user.id || user.userId}</p>
                    </div>
                </div>
            </div>

            {/* Content Info */}
            <div className="max-w-lg mx-auto px-4 -mt-10 pb-8">
                <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-sm overflow-hidden mb-4">
                    <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 border-b border-gray-100 dark:border-gray-800">
                        <button 
                            onClick={() => setShowQrCode(true)}
                            className="flex flex-col items-center gap-2 py-4 hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors"
                        >
                            <QrCode className="w-5 h-5 text-primary-600" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Mã QR</span>
                        </button>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex flex-col items-center gap-2 py-4 hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors"
                        >
                            <Edit2 className="w-5 h-5 text-green-600" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Sửa hồ sơ</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex flex-col items-center gap-2 py-4 hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors"
                        >
                            <LogOut className="w-5 h-5 text-red-600" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Đăng xuất</span>
                        </button>
                    </div>

                    <div className="p-4 space-y-6">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Thông tin cá nhân</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Số điện thoại</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.phone || 'Chưa cập nhật'}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Ngày sinh</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {user.birthday ? new Date(user.birthday).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600">
                                        <UserIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Giới tính</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {user.gender === 'male' ? 'Nam' : user.gender === 'female' ? 'Nữ' : 'Khác'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-600">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal (Mobile Style) */}
            {isEditing && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-dark-200 w-full max-w-lg h-full sm:h-auto sm:rounded-3xl flex flex-col overflow-hidden animate-slide-up">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <button onClick={() => setIsEditing(false)} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-full">
                                <X className="w-6 h-6" />
                            </button>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Chỉnh sửa hồ sơ</h3>
                            <div className="w-10" /> {/* Spacer */}
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Avatar Section */}
                            <div className="flex flex-col items-center">
                                <div className="relative">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} className="w-24 h-24 rounded-3xl object-cover shadow-lg border-2 border-primary-500" />
                                    ) : (
                                        <div className="w-24 h-24 rounded-3xl bg-gray-100 dark:bg-dark-300 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                                            <Camera className="w-8 h-8" />
                                        </div>
                                    )}
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors flex items-center gap-2"
                                    >
                                        <Camera className="w-4 h-4" /> Chọn ảnh
                                    </button>
                                    {avatarUrl && (
                                        <button 
                                            onClick={handleRemoveAvatar}
                                            className="px-4 py-2 bg-gray-100 dark:bg-dark-300 text-gray-600 dark:text-gray-400 text-sm font-semibold rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
                                        >
                                            Xóa
                                        </button>
                                    )}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 text-center">Ảnh chọn sẽ được tải lên server trước khi lưu.</p>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase px-1">Họ và tên</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-300 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-medium"
                                        placeholder="Nhập họ và tên..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase px-1">Số điện thoại</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-300 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-medium"
                                        placeholder="09xxx..."
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase px-1">Ngày sinh</label>
                                    <input
                                        type="date"
                                        value={birthday}
                                        onChange={(e) => setBirthday(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-300 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-medium"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase px-1">Giới tính</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'male', label: 'Nam' },
                                            { id: 'female', label: 'Nữ' },
                                            { id: 'other', label: 'Khác' }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setGender(opt.id)}
                                                className={`flex-1 py-3 px-4 rounded-2xl text-sm font-semibold transition-all ${
                                                    gender === opt.id
                                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                                        : 'bg-gray-50 dark:bg-dark-300 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-400'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase px-1">Giới thiệu</label>
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-300 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-medium resize-none"
                                        placeholder="Viết vài dòng về bản thân..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-4 text-sm font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-300 rounded-2xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading || isUploading}
                                className="flex-1 py-4 bg-primary-500 text-white text-sm font-bold rounded-2xl hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* QR Code Modal */}
            {showQrCode && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-dark-200 w-full max-w-sm rounded-3xl flex flex-col overflow-hidden animate-slide-up">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mã QR của tôi</h3>
                            <button onClick={() => setShowQrCode(false)} className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-full">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex flex-col items-center p-8 space-y-6">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                <QRCode value={`userId:${user.id || user.userId || ""}`} size={200} />
                            </div>
                            <div className="text-center space-y-2">
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.fullName}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Dùng mã này để kết bạn với tôi</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
