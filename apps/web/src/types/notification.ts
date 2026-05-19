export type AppNotificationType =
  | 'moment_reaction'
  | 'moment_comment'
  | 'moment_comment_reply'
  | 'moment_comment_reaction'
  | 'activity'

export interface AppNotification {
  notificationId: string
  recipientId: string
  actorId: string
  actorName: string
  actorAvatarUrl: string | null
  type: AppNotificationType
  title: string
  body: string
  momentId: string | null
  commentId: string | null
  reactionEmoji: string | null
  metadata: Record<string, unknown> | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  updatedAt: string
}
