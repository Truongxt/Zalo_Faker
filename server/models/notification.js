const { ulid } = require("ulid");

function createNotification({
  recipientId,
  actorId,
  actorName,
  actorAvatarUrl = null,
  type,
  title,
  body = "",
  momentId = null,
  commentId = null,
  reactionEmoji = null,
  metadata = null,
}) {
  const now = new Date().toISOString();

  return {
    notificationId: ulid(),
    recipientId: String(recipientId),
    actorId: String(actorId),
    actorName: String(actorName || "Nguoi dung"),
    actorAvatarUrl: actorAvatarUrl || null,
    type: String(type || "activity"),
    title: String(title || "").trim(),
    body: String(body || "").trim(),
    momentId: momentId ? String(momentId) : null,
    commentId: commentId ? String(commentId) : null,
    reactionEmoji: reactionEmoji ? String(reactionEmoji) : null,
    metadata: metadata && typeof metadata === "object" ? metadata : null,
    isRead: false,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { createNotification };
