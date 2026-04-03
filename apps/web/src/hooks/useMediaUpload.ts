import { useCallback } from 'react'
import { useToast } from '@/contexts/ToastContext'

interface MediaUploadError {
    type: 'size' | 'read' | 'send' | 'unknown'
    message: string
}

export function useMediaUpload() {
    const { addToast } = useToast()

    const getFileTypeLabel = (type: 'image' | 'video' | 'file' | 'voice') => {
        const labels: Record<string, string> = {
            image: 'Hình ảnh',
            video: 'Video',
            file: 'File',
            voice: 'Tin nhắn thoại',
        }
        return labels[type] || 'File'
    }

    const validateFile = useCallback(
        (file: File, type: 'image' | 'video' | 'file' | 'voice') => {
            const maxSizeBytes = 5 * 1024 * 1024

            if (!file) {
                return { valid: false, error: undefined }
            }

            if (file.size > maxSizeBytes) {
                const sizeInMB = (maxSizeBytes / (1024 * 1024)).toFixed(0)
                const error: MediaUploadError = {
                    type: 'size',
                    message: `${getFileTypeLabel(type)} quá lớn. Tối đa ${sizeInMB}MB.`,
                }
                addToast(error.message, 'error', 5000)
                return { valid: false, error }
            }

            // File type validation
            if (type === 'image' && !file.type.startsWith('image/')) {
                const error: MediaUploadError = {
                    type: 'size',
                    message: 'Vui lòng chọn một file hình ảnh hợp lệ.',
                }
                addToast(error.message, 'error')
                return { valid: false, error }
            }

            if (type === 'video' && !file.type.startsWith('video/')) {
                const error: MediaUploadError = {
                    type: 'size',
                    message: 'Vui lòng chọn một file video hợp lệ.',
                }
                addToast(error.message, 'error')
                return { valid: false, error }
            }

            return { valid: true, error: undefined }
        },
        [addToast]
    )

    const handleUploadError = useCallback(
        (error: unknown, type: 'image' | 'video' | 'file' | 'voice') => {
            console.error('Upload error:', error)

            let message = `Không thể gửi ${getFileTypeLabel(type).toLowerCase()}. Vui lòng thử lại.`

            if (error instanceof Error) {
                if (error.message.includes('timeout')) {
                    message = 'Gửi file timeout. Vui lòng kiểm tra kết nối và thử lại.'
                } else if (error.message.includes('NotAllowedError')) {
                    message = 'Quyền truy cập bị từ chối. Vui lòng cấp quyền và thử lại.'
                }
            }

            addToast(message, 'error', 5000)
        },
        [addToast]
    )

    return {
        validateFile,
        handleUploadError,
        getFileTypeLabel,
    }
}
