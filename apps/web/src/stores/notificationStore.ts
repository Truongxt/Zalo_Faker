import { create } from 'zustand'
import type { AppNotification } from '@/types/notification'

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  isLoading: boolean
  setLoading: (value: boolean) => void
  setNotifications: (notifications: AppNotification[], unreadCount?: number) => void
  prependNotification: (notification: AppNotification) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
  setNotifications: (notifications, unreadCount) =>
    set({
      notifications,
      unreadCount:
        typeof unreadCount === 'number'
          ? unreadCount
          : notifications.reduce((total, item) => total + (item.isRead ? 0 : 1), 0),
    }),
  prependNotification: (notification) =>
    set((state) => {
      const deduped = [
        notification,
        ...state.notifications.filter(
          (item) => item.notificationId !== notification.notificationId,
        ),
      ]

      return {
        notifications: deduped,
        unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
      }
    }),
  markAsRead: (notificationId) =>
    set((state) => {
      let didChange = false

      const notifications = state.notifications.map((notification) => {
        if (notification.notificationId !== notificationId || notification.isRead) {
          return notification
        }

        didChange = true
        return {
          ...notification,
          isRead: true,
          readAt: new Date().toISOString(),
        }
      })

      return {
        notifications,
        unreadCount: didChange ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      }
    }),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || new Date().toISOString(),
      })),
      unreadCount: 0,
    })),
  reset: () =>
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
    }),
}))
