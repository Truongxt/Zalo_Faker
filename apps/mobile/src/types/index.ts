// ========================
// User
// ========================
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  birthday?: string | null;
  gender?: string | null;
  bio: string | null;
  status: "online" | "offline" | "away" | "busy";
  lastSeen: string | null;
  createdAt: string;
}

// ========================
// Message
// ========================
export type MessageType = "text" | "image" | "video" | "file" | "voice" | "sticker" | "system";

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface MessageAttachment {
  url: string;
  type: "image" | "video" | "file" | "voice";
  name?: string;
  size?: number;
  duration?: number; // voice/video duration
  thumbnailUrl?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  type: MessageType;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  } | null;
  isDeleted: boolean;
  isEdited: boolean;
  readBy: string[];
  createdAt: string;
  updatedAt?: string;
}

// ========================
// Conversation
// ========================
export type ConversationType = "private" | "group";

export interface Participant {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  joinedAt: string;
  nickname?: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null; // null for private, group name for group
  avatarUrl: string | null;
  participants: Participant[];
  lastMessage: {
    content: string;
    senderId: string;
    senderName: string;
    type: MessageType;
    createdAt: string;
  } | null;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ========================
// Contact / Friend
// ========================
export interface Contact {
  id: string;
  user: User;
  nickname?: string;
  isFavorite: boolean;
  addedAt: string;
}

export interface Friends {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUser?: User;
  message?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

// ========================
// Call
// ========================
export type CallType = "voice" | "video";
export type CallStatus = "ringing" | "ongoing" | "ended" | "missed" | "rejected";

export interface Call {
  id: string;
  type: CallType;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  receiverIds: string[];
  conversationId: string;
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  duration?: number; // seconds
}

// ========================
// Notification
// ========================
export interface AppNotification {
  id: string;
  type: "message" | "call" | "friend_request" | "group_invite" | "system";
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

// ========================
// API Response
// ========================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// ========================
// Moment
// ========================
export type MomentType = "post" | "share";

export interface MomentAuthor {
  userId: string;
  userName: string;
  avartarUrl: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
}

export interface MomentSnapshot {
  momentId: string;
  authorId: string;
  content: string;
  mediaUrls: string[];
  type: MomentType;
  createdAt: string;
  author?: MomentAuthor | null;
}

export interface Moment {
  momentId: string;
  authorId: string;
  type: MomentType;
  content: string;
  mediaUrls: string[];
  originalMomentId: string | null;
  originalMomentSnapshot: MomentSnapshot | null;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
  author: MomentAuthor | null;
  currentUserReaction: string | null;
  isOwner: boolean;
}

export interface MomentComment {
  momentId: string;
  commentId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: MomentAuthor | null;
}

export interface MomentProfile {
  user: MomentAuthor | null;
  moments: Moment[];
}
