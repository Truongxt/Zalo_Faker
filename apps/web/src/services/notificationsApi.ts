import { fetchWithAuth } from './api'
import type { AppNotification } from '@/types/notification'

type NotificationListResponse = {
  notifications: AppNotification[]
  unreadCount: number
}

export const notificationsApi = {
  async getNotifications(limit = 50): Promise<NotificationListResponse> {
    const response = await fetchWithAuth(`/notifications?limit=${limit}`)
    return response.json()
  },

  async markAsRead(notificationId: string): Promise<AppNotification> {
    const response = await fetchWithAuth(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    })
    return response.json()
  },

  async markAllAsRead(): Promise<{ updatedCount: number }> {
    const response = await fetchWithAuth('/notifications/read-all', {
      method: 'PATCH',
    })
    return response.json()
  },
}
