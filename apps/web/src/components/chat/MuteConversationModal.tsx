import { X } from 'lucide-react'
import { MuteDurationOption, formatMuteUntilLabel, getMuteUntil } from '@/lib/muteUtils'

interface MuteConversationModalProps {
    conversationName: string
    isMuted: boolean
    muteUntil?: string | null
    onApply: (settings: { isMuted: boolean; muteUntil: string | null }) => Promise<void>
    onClose: () => void
}

const MUTE_OPTIONS: Array<{
    key: MuteDurationOption
    label: string
    description: string
}> = [
    { key: '1_hour', label: 'Trong 1 giờ', description: 'Tự bật lại sau 60 phút.' },
    { key: '4_hours', label: 'Trong 4 giờ', description: 'Phù hợp khi cần tập trung trong nửa ngày.' },
    { key: 'until_8am', label: 'Đến 8 giờ sáng', description: 'Tắt thông báo đến mốc 08:00 gần nhất.' },
    { key: 'until_turn_on', label: 'Cho đến khi được mở lại', description: 'Giữ im lặng cho đến khi bạn tự bật lại.' },
]

export default function MuteConversationModal({
    conversationName,
    isMuted,
    muteUntil,
    onApply,
    onClose,
}: MuteConversationModalProps) {
    const handleApply = async (option: MuteDurationOption) => {
        await onApply({
            isMuted: true,
            muteUntil: getMuteUntil(option),
        })
        onClose()
    }

    const handleTurnOn = async () => {
        await onApply({ isMuted: false, muteUntil: null })
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-dark-300 rounded-2xl shadow-xl max-w-md w-full mx-4 animate-scale-in">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-300 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Tắt thông báo
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[260px]">
                            {conversationName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-3">
                    {isMuted && (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                            Cuộc trò chuyện này hiện đang tắt thông báo {formatMuteUntilLabel(muteUntil)}.
                        </div>
                    )}

                    {MUTE_OPTIONS.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => handleApply(option.key)}
                            className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-colors"
                        >
                            <p className="font-medium text-gray-900 dark:text-white">{option.label}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>
                        </button>
                    ))}
                </div>

                <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-100 flex justify-end gap-2">
                    {isMuted && (
                        <button
                            onClick={handleTurnOn}
                            className="px-4 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 rounded-lg transition-colors font-medium"
                        >
                            Bật lại thông báo
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                    >
                        Hủy
                    </button>
                </div>
            </div>
        </div>
    )
}
