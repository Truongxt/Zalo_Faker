import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'

export default function ChatLayout() {
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-dark-100">
            {/* Sidebar with conversations list */}
            <Sidebar />

            {/* Main content area */}
            <Outlet />
        </div>
    )
}
