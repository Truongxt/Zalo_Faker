const { createNotification } = require("../models/notification");
const notificationRepository = require("../repository/notificationRepository");
const { emitToUser } = require("../utils/socketEmitter");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeNotification = (notification) => ({
  ...notification,
  notificationId: String(notification.notificationId),
  recipientId: String(notification.recipientId),
  actorId: String(notification.actorId),
  actorName: String(notification.actorName || "Nguoi dung"),
  actorAvatarUrl: notification.actorAvatarUrl || null,
  momentId: notification.momentId ? String(notification.momentId) : null,
  commentId: notification.commentId ? String(notification.commentId) : null,
  reactionEmoji: notification.reactionEmoji || null,
  metadata:
    notification.metadata && typeof notification.metadata === "object"
      ? notification.metadata
      : null,
  isRead: Boolean(notification.isRead),
  readAt: notification.readAt || null,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const countUnread = (notifications = []) =>
  notifications.reduce(
    (total, notification) => total + (notification?.isRead ? 0 : 1),
    0,
  );

const NotificationService = {
  async createNotification(payload) {
    if (!payload?.recipientId || !payload?.actorId) {
      throw createError("recipientId and actorId are required", 400);
    }

    if (String(payload.recipientId) === String(payload.actorId)) {
      return null;
    }

    const notification = createNotification(payload);
    const saved = normalizeNotification(
      await notificationRepository.create(notification),
    );

    await emitToUser(saved.recipientId, "notification:new", saved);
    return saved;
  },

  async listNotifications(userId, { limit = 50 } = {}) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const [notifications, allNotifications] = await Promise.all([
      notificationRepository.listByRecipient(userId, limit),
      notificationRepository.listAllByRecipient(userId),
    ]);

    return {
      notifications: notifications.map(normalizeNotification),
      unreadCount: countUnread(allNotifications),
    };
  },

  async markAsRead(notificationId, userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const existing = await notificationRepository.getById(notificationId);
    if (!existing) {
      throw createError("Notification not found", 404);
    }

    if (String(existing.recipientId) !== String(userId)) {
      throw createError("You do not have permission to update this notification", 403);
    }

    if (existing.isRead) {
      return normalizeNotification(existing);
    }

    const updated = await notificationRepository.update(notificationId, {
      isRead: true,
      readAt: new Date().toISOString(),
    });

    return normalizeNotification(updated);
  },

  async markAllAsRead(userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const notifications = await notificationRepository.listAllByRecipient(userId);
    const unreadNotifications = notifications.filter((notification) => !notification.isRead);

    await Promise.all(
      unreadNotifications.map((notification) =>
        notificationRepository.update(notification.notificationId, {
          isRead: true,
          readAt: new Date().toISOString(),
        })),
    );

    return { updatedCount: unreadNotifications.length };
  },
};

module.exports = NotificationService;
