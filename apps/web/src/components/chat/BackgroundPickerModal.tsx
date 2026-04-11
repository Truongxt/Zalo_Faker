import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from 'react'
import { X, Upload } from 'lucide-react'
import { uploadMedia } from '@/services/api'

interface BackgroundPickerModalProps {
    currentBackground?: string
    onApply: (backgroundUrl: string) => Promise<void>
    onClose: () => void
}

const PRESET_BACKGROUNDS = [
    { name: 'Nền trắng', value: '' },
    { name: 'Xanh nhạt', value: 'linear-gradient(135deg, #E0F7FF 0%, #B3E5FC 100%)' },
    { name: 'Hồng nhạt', value: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD0 100%)' },
    { name: 'Vàng nhạt', value: 'linear-gradient(135deg, #FFFDE7 0%, #FFF9C4 100%)' },
    { name: 'Xanh lá nhạt', value: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)' },
    { name: 'Tím nhạt', value: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)' },
    { name: 'Cam nhạt', value: 'linear-gradient(135deg, #FFE0B2 0%, #FFCC80 100%)' },
]

export default function BackgroundPickerModal({
    currentBackground,
    onApply,
    onClose,
}: BackgroundPickerModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [customUrl, setCustomUrl] = useState('')
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        return () => {
            if (localPreviewUrl) {
                URL.revokeObjectURL(localPreviewUrl)
            }
        }
    }, [localPreviewUrl])

    const clearLocalPreview = () => {
        setLocalPreviewUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev)
            }
            return null
        })
    }

    const getBackgroundStyle = (backgroundValue?: string): CSSProperties => {
        const value = backgroundValue?.trim()

        if (!value) {
            return { background: '#ffffff' }
        }

        if (/^(https?:\/\/|data:|blob:|\/)/i.test(value)) {
            return {
                backgroundImage: `url(${value})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }
        }

        return { background: value }
    }

    const handleApplyPreset = async (bgValue: string) => {
        try {
            setIsLoading(true)
            setError(null)
            clearLocalPreview()
            await onApply(bgValue)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
        } finally {
            setIsLoading(false)
        }
    }

    const handleApplyCustom = async () => {
        if (!customUrl.trim()) {
            setError('Vui lòng nhập URL hình ảnh')
            return
        }

        try {
            setIsLoading(true)
            setError(null)
            clearLocalPreview()
            await onApply(customUrl.trim())
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
        } finally {
            setIsLoading(false)
        }
    }

    const handlePickFromLibrary = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setError('Vui lòng chọn một file hình ảnh hợp lệ')
            e.target.value = ''
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Hình nền quá lớn. Tối đa 5MB.')
            e.target.value = ''
            return
        }

        const previewUrl = URL.createObjectURL(file)
        setLocalPreviewUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev)
            }
            return previewUrl
        })

        try {
            setIsLoading(true)
            setError(null)
            const uploadResult = await uploadMedia(file)
            await onApply(uploadResult.url)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải ảnh lên')
        } finally {
            setIsLoading(false)
            e.target.value = ''
        }
    }

    const isPresetSelected = (bgValue: string) => currentBackground === bgValue
    const previewValue = localPreviewUrl || customUrl

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-dark-300 rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in">
                {/* Header */}
                <div className="sticky top-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-300 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Đổi hình nền
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Error message */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Preset backgrounds */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                            Hình nền có sẵn
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {PRESET_BACKGROUNDS.map((bg, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleApplyPreset(bg.value)}
                                    disabled={isLoading}
                                    className={`relative h-32 rounded-xl overflow-hidden border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isPresetSelected(bg.value)
                                        ? 'border-primary-500 shadow-lg'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                >
                                    <div
                                        className="w-full h-full"
                                        style={{
                                            background: bg.value || '#ffffff',
                                        }}
                                    />
                                    {isPresetSelected(bg.value) && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                                            <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                                                <div className="w-3 h-3 rounded-full bg-white" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                                        <p className="text-xs text-white font-medium truncate">{bg.name}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                            Ảnh từ thư viện
                        </h3>
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="w-full px-4 py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Đang tải ảnh lên...' : 'Chọn ảnh từ thư viện'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePickFromLibrary}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Hỗ trợ ảnh JPG, PNG, WEBP. Tối đa 5MB.
                            </p>
                        </div>
                    </div>

                    {/* Custom URL */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                            URL hình nền tùy chỉnh
                        </h3>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={customUrl}
                                    onChange={(e) => {
                                        clearLocalPreview()
                                        setCustomUrl(e.target.value)
                                        setError(null)
                                    }}
                                    placeholder="https://..."
                                    disabled={isLoading}
                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-dark-100 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                                />
                                <button
                                    onClick={handleApplyCustom}
                                    disabled={isLoading || !customUrl.trim()}
                                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium flex items-center gap-2 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4" />
                                    )}
                                    <span className="hidden sm:inline">Áp dụng</span>
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Nhập URL hình ảnh đầy đủ (HTTPS)
                            </p>
                        </div>
                    </div>

                    {/* Preview */}
                    {previewValue && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Xem trước
                            </h3>
                            <div
                                className="w-full h-48 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-cover bg-center"
                                style={getBackgroundStyle(previewValue)}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-100 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Hủy
                    </button>
                </div>
            </div>
        </div>
    )
}
