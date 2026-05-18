import { apiFetch } from "./fetchClient";
import type { MomentActivityNotification } from "@/types";

type NotificationListResponse = {
  notifications: MomentActivityNotification[];
  unreadCount: number;
};

class NotificationsApi {
  async getNotifications(limit = 50): Promise<NotificationListResponse> {
    return apiFetch<NotificationListResponse>(`/api/notifications?limit=${limit}`);
  }

  async markAsRead(notificationId: string): Promise<MomentActivityNotification> {
    return apiFetch<MomentActivityNotification>(`/api/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
  }

  async markAllAsRead(): Promise<{ updatedCount: number }> {
    return apiFetch<{ updatedCount: number }>("/api/notifications/read-all", {
      method: "PATCH",
    });
  }
}

export const notificationsApi = new NotificationsApi();
