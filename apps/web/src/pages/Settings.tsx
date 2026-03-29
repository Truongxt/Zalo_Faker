import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft,
    Bell,
    Moon,
    Lock,
    Globe,
    HelpCircle,
    Info,
    ChevronRight,
    Shield,
    Trash2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export default function Settings() {
    const navigate = useNavigate()
    const [darkMode, setDarkMode] = useState(false)
    const [notifications, setNotifications] = useState(true)

    const toggleDarkMode = () => {
        setDarkMode(!darkMode)
        document.documentElement.classList.toggle('dark')
    }

    type ToggleItem = {
        icon: LucideIcon
        label: string
        description?: string
        action: 'toggle'
        value: boolean
        onChange: () => void
        danger?: boolean
    }

    type NavigateItem = {
        icon: LucideIcon
        label: string
        description?: string
        action: 'navigate'
        danger?: boolean
    }

    type SettingItem = ToggleItem | NavigateItem

    type SettingsSection = {
        title: string
        items: SettingItem[]
    }

    const settingsSections: SettingsSection[] = [
        {
            title: 'Thông báo',
            items: [
                {
                    icon: Bell,
                    label: 'Thông báo',
                    description: 'Quản lý thông báo',
                    action: 'toggle',
                    value: notifications,
                    onChange: () => setNotifications(!notifications)
                }
            ]
        },
        {
            title: 'Giao diện',
            items: [
                {
                    icon: Moon,
                    label: 'Chế độ tối',
                    description: 'Chuyển sang giao diện tối',
                    action: 'toggle',
                    value: darkMode,
                    onChange: toggleDarkMode
                },
                {
                    icon: Globe,
                    label: 'Ngôn ngữ',
                    description: 'Tiếng Việt',
                    action: 'navigate'
                }
            ]
        },
        {
            title: 'Bảo mật',
            items: [
                {
                    icon: Lock,
                    label: 'Thay đổi mật khẩu',
                    description: 'Cập nhật mật khẩu đăng nhập',
                    action: 'navigate'
                },
                {
                    icon: Shield,
                    label: 'Xác thực hai yếu tố',
                    description: 'Thêm lớp bảo mật cho tài khoản',
                    action: 'navigate'
                }
            ]
        },
        {
            title: 'Khác',
            items: [
                {
                    icon: HelpCircle,
                    label: 'Trợ giúp & Hỗ trợ',
                    action: 'navigate'
                },
                {
                    icon: Info,
                    label: 'Về ứng dụng',
                    description: 'Phiên bản 1.0.0',
                    action: 'navigate'
                },
                {
                    icon: Trash2,
                    label: 'Xóa tài khoản',
                    description: 'Xóa vĩnh viễn tài khoản của bạn',
                    action: 'navigate',
                    danger: true
                }
            ]
        }
    ]

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-100">
            {/* Header */}
            <div className="bg-white dark:bg-dark-200 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Cài đặt</h1>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-lg mx-auto p-4 space-y-6">
                {settingsSections.map((section, index) => (
                    <div key={index} className="card p-0 overflow-hidden">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 px-4 pt-4 pb-2">
                            {section.title}
                        </h3>

                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {section.items.map((item, itemIndex) => (
                                <button
                                    key={itemIndex}
                                    className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                                        }`}
                            onClick={() => {
                                if (item.action === 'toggle') item.onChange()
                            }}
                                >
                                    <div className="flex items-center gap-4">
                                        <item.icon className={`w-5 h-5 ${item.danger ? '' : 'text-gray-400'
                                            }`} />
                                        <div className="text-left">
                                            <p className="font-medium">{item.label}</p>
                                            {item.description && (
                                                <p className={`text-sm ${item.danger ? 'text-red-400' : 'text-gray-500 dark:text-gray-400'
                                                    }`}>
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {item.action === 'toggle' ? (
                                        <div className={`w-11 h-6 rounded-full transition-colors relative ${item.value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                                            }`}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${item.value ? 'translate-x-5' : 'translate-x-0.5'
                                                }`} />
                                        </div>
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
