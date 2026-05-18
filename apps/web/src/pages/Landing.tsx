import { Link } from 'react-router-dom'
import { MessageCircle, Check, Download, Globe, Monitor, Smartphone, TabletSmartphone } from 'lucide-react'

export default function Landing() {
    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* ========== NAVBAR ========== */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-primary-500">Zalo</span>
                        </Link>

                        {/* Nav links — hidden on mobile */}
                        <nav className="hidden md:flex items-center gap-8">
                            <a href="#" className="text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors">
                                ZALO PC
                            </a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                                OFFICIAL ACCOUNT
                            </a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                                NHÀ PHÁT TRIỂN
                            </a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                                BẢO MẬT
                            </a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                                TRỢ GIÚP
                            </a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                                LIÊN HỆ
                            </a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                                BÁO CÁO VI PHẠM
                            </a>
                        </nav>

                        {/* CTA */}
                        <Link
                            to="/login"
                            className="text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors"
                        >
                            ĐĂNG NHẬP
                        </Link>
                    </div>
                </div>
            </header>

            {/* ========== HERO SECTION ========== */}
            <main className="flex-1">
                <div className="bg-[#f5f7fa]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
                        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                            {/* Left content */}
                            <div className="flex-1 max-w-xl">
                                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-gray-900 leading-tight mb-3">
                                    Tải Zalo PC cho máy tính
                                </h1>
                                <p className="text-lg sm:text-xl text-gray-700 mb-8 leading-relaxed">
                                    Ứng dụng Zalo PC đã có mặt trên Windows, Mac OS, Web
                                </p>

                                {/* Feature checklist */}
                                <div className="space-y-4 mb-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                        </div>
                                        <span className="text-base text-gray-700">
                                            Gửi file, ảnh, video cực nhanh lên đến 1GB
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                        </div>
                                        <span className="text-base text-gray-700">
                                            Đồng bộ tin nhắn với điện thoại
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                        </div>
                                        <span className="text-base text-gray-700">
                                            Tối ưu cho chat nhóm và trao đổi công việc
                                        </span>
                                    </div>
                                </div>

                                {/* CTA Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <a
                                        href="#"
                                        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary-500 text-white font-semibold rounded-full hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg"
                                    >
                                        <Download className="w-5 h-5" />
                                        Tải ngay
                                    </a>
                                    <Link
                                        to="/login"
                                        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-primary-500 font-semibold rounded-full border-2 border-primary-500 hover:bg-primary-50 transition-colors"
                                    >
                                        <Globe className="w-5 h-5" />
                                        Dùng bản web
                                    </Link>
                                </div>
                            </div>

                            {/* Right side — Device mockup illustration */}
                            <div className="flex-1 hidden lg:flex items-center justify-center relative">
                                <div className="relative w-full max-w-lg">
                                    {/* Desktop mockup */}
                                    <div className="relative bg-white rounded-2xl shadow-strong p-3 transform -rotate-2">
                                        <div className="bg-gray-100 rounded-xl overflow-hidden">
                                            {/* Title bar */}
                                            <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200">
                                                <div className="flex gap-1.5">
                                                    <div className="w-3 h-3 rounded-full bg-red-400" />
                                                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                                    <div className="w-3 h-3 rounded-full bg-green-400" />
                                                </div>
                                                <div className="flex-1 flex items-center justify-center">
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                                        <MessageCircle className="w-4 h-4 text-primary-500" />
                                                        <span className="font-medium">taklo</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* App body */}
                                            <div className="flex h-64">
                                                {/* Mini sidebar */}
                                                <div className="w-1/3 border-r border-gray-200 p-3 space-y-2">
                                                    <div className="h-7 bg-gray-200 rounded-lg" />
                                                    {[1, 2, 3, 4, 5].map(i => (
                                                        <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${i === 1 ? 'bg-primary-50' : ''}`}>
                                                            <div className={`w-8 h-8 rounded-full flex-shrink-0 ${i === 1 ? 'bg-primary-200' : 'bg-gray-200'}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`h-3 rounded w-3/4 mb-1 ${i === 1 ? 'bg-primary-200' : 'bg-gray-200'}`} />
                                                                <div className="h-2 bg-gray-200 rounded w-full" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Mini chat */}
                                                <div className="flex-1 flex flex-col p-3">
                                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200 mb-3">
                                                        <div className="w-7 h-7 rounded-full bg-primary-200" />
                                                        <div className="h-3 bg-gray-200 rounded w-20" />
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex justify-start"><div className="h-6 bg-gray-200 rounded-xl px-3 w-32" /></div>
                                                        <div className="flex justify-end"><div className="h-6 bg-primary-500 rounded-xl px-3 w-28" /></div>
                                                        <div className="flex justify-start"><div className="h-6 bg-gray-200 rounded-xl px-3 w-36" /></div>
                                                        <div className="flex justify-end"><div className="h-6 bg-primary-500 rounded-xl px-3 w-24" /></div>
                                                        <div className="flex justify-start"><div className="h-6 bg-gray-200 rounded-xl px-3 w-28" /></div>
                                                    </div>
                                                    <div className="h-8 bg-gray-200 rounded-full mt-2" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Phone mockup */}
                                    <div className="absolute -bottom-6 -right-4 w-36 bg-white rounded-2xl shadow-strong p-2 transform rotate-6 border border-gray-100">
                                        <div className="bg-gray-100 rounded-xl overflow-hidden">
                                            {/* Phone status bar */}
                                            <div className="flex items-center justify-between px-3 py-1.5 bg-white">
                                                <div className="text-[8px] font-medium text-gray-500">9:41</div>
                                                <div className="flex gap-1">
                                                    <div className="w-3 h-1.5 bg-gray-300 rounded-sm" />
                                                    <div className="w-3 h-1.5 bg-gray-300 rounded-sm" />
                                                </div>
                                            </div>
                                            {/* Phone content */}
                                            <div className="p-2 space-y-1.5">
                                                {[1, 2, 3, 4].map(i => (
                                                    <div key={i} className="flex items-center gap-1.5">
                                                        <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="h-2 bg-gray-200 rounded w-3/4 mb-0.5" />
                                                            <div className="h-1.5 bg-gray-200 rounded w-full" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Phone bottom nav */}
                                            <div className="flex justify-around py-1.5 border-t border-gray-200 mt-1">
                                                <div className="w-4 h-4 rounded bg-primary-200" />
                                                <div className="w-4 h-4 rounded bg-gray-200" />
                                                <div className="w-4 h-4 rounded bg-gray-200" />
                                                <div className="w-4 h-4 rounded bg-gray-200" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tablet hint */}
                                    <div className="absolute -top-4 -left-6 bg-white rounded-xl shadow-medium p-3 flex items-center gap-2 transform -rotate-6">
                                        <TabletSmartphone className="w-5 h-5 text-primary-500" />
                                        <span className="text-xs font-medium text-gray-600">Đa nền tảng</span>
                                    </div>

                                    {/* Floating badge — platforms */}
                                    <div className="absolute top-2 right-6 bg-white rounded-lg shadow-soft px-3 py-2 flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                            <Monitor className="w-4 h-4 text-gray-500" />
                                            <span className="text-xs text-gray-500">Windows</span>
                                        </div>
                                        <div className="w-px h-4 bg-gray-200" />
                                        <div className="flex items-center gap-1.5">
                                            <Smartphone className="w-4 h-4 text-gray-500" />
                                            <span className="text-xs text-gray-500">Mobile</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ========== FOOTER ========== */}
            <footer className="border-t border-gray-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-gray-500">
                        <span>© 2012 - 2026 Một sản phẩm của Zalo Group -</span>
                        <div className="flex items-center gap-2">
                            <a href="#" className="text-primary-500 hover:text-primary-600 transition-colors">
                                Điều khoản sử dụng dịch vụ
                            </a>
                            <span>-</span>
                            <a href="#" className="text-primary-500 hover:text-primary-600 transition-colors">
                                Thông báo xử lý dữ liệu
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
