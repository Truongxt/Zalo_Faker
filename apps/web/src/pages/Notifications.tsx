import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/stores/notificationStore'
import { notificationsApi } from '@/services/notificationsApi'

export default function Notifications() {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    isLoading,
    setLoading,
    setNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore()
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setLoading(true)
        const result = await notificationsApi.getNotifications()
        setNotifications(result.notifications || [], result.unreadCount || 0)
      } catch (error) {
        console.error('Failed to load notifications:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadNotifications()
  }, [setLoading, setNotifications])

  const handleOpenNotification = async (notificationId: string) => {
    const target = notifications.find(
      (notification) => notification.notificationId === notificationId,
    )
    if (!target) return

    if (!target.isRead) {
      markAsRead(notificationId)
      try {
        await notificationsApi.markAsRead(notificationId)
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
      }
    }

    navigate('/chat/moments')
  }

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return

    try {
      setIsMarkingAll(true)
      markAllAsRead()
      await notificationsApi.markAllAsRead()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    } finally {
      setIsMarkingAll(false)
    }
  }

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-dark-100">
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-dark-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-900/30">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thông báo</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã xem hết thông báo'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0 || isMarkingAll}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-dark-300 dark:text-gray-200 dark:hover:bg-dark-400"
        >
          <CheckCheck className="h-4 w-4" />
          Đánh dấu đã đọc
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {isLoading ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-800 dark:bg-dark-200 dark:text-gray-400">
              Đang tải thông báo...
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-dark-200">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-dark-300 dark:text-gray-300">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Chưa có thông báo moment
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Khi ai đó tương tác với khoảnh khắc hoặc bình luận của bạn, thông báo sẽ hiện ở đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <button
                  key={notification.notificationId}
                  type="button"
                  onClick={() => void handleOpenNotification(notification.notificationId)}
                  className={`w-full rounded-3xl border px-5 py-4 text-left transition-colors ${
                    notification.isRead
                      ? 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-dark-200 dark:hover:bg-dark-300'
                      : 'border-primary-200 bg-primary-50/70 hover:bg-primary-50 dark:border-primary-900/50 dark:bg-primary-900/20 dark:hover:bg-primary-900/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {notification.actorAvatarUrl ? (
                      <img
                        src={notification.actorAvatarUrl}
                        alt={notification.actorName}
                        className="h-11 w-11 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-900/30">
                        {notification.actorName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          {notification.body ? (
                            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                              {notification.body}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {!notification.isRead && (
                            <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary-500" />
                          )}
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
