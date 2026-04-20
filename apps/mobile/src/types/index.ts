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
  hasHiddenPin?: boolean;
}

// Raw user shape returned from server
export interface ServerUser {
  userId: string;
  email: string;
  phone: string;
  userName: string;
  avartarUrl: string | null;
  birthday: string | null;
  gender: string;
  status: string;
  accountStatus?: "active" | "locked" | "deleted";
  presenceStatus?: "online" | "offline";
  lastActiveAt?: string | null;
  createdAt: string;
  hiddenChatPin?: string | null;
}

// User service request/response types
export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface UpdateUserData {
  userName?: string;
  phone?: string;
  avartarUrl?: string;
  birthday?: string;
  gender?: string;
  password?: string;
  status?: string;
  bio?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  userName: string;
  phone: string;
  gender: string;
  birthday: string;
  avartarUrl: string;
  status?: string;
}

export interface ForgotPasswordResponse {
  message: string;
  expiresIn: number;
}

export interface UploadResponse {
  url: string;
}

// ========================
// Login History
// ========================
export interface LoginHistoryItem {
  userId: string;
  loginId: string;
  loginAt: string;
  platform: string;   // "mobile" | "web" | "unknown"
  deviceInfo: string;
  ipAddress: string;
}

// ========================
// Message
// ========================
export type MessageType = "text" | "image" | "video" | "file" | "voice" | "sticker" | "call" | "system" | "poll";

export interface PollOption {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
}

export interface PollVote {
  userId: string;
  optionIds: string[];
  votedAt: string;
}

export interface PollSettings {
  anonymousVoters: boolean;
  hideResultsUntilVote: boolean;
  allowMultipleChoices: boolean;
  allowAddOptions: boolean;
  expiresAt: string | null;
}

export interface PollContent {
  question: string;
  options: PollOption[];
  settings: PollSettings;
  votes: PollVote[];
  createdBy: string;
  createdAt: string;
}

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
  transcript?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: any;
  metadata?: any;
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

export interface Label {
  _id: string;
  userId: string;
  name: string;
  color: string;
}

export interface GroupPinnedMessage {
  messageId: string;
  senderId: string;
  type: MessageType;
  content: any; // Using any for simplicity as it matches message content
  metadata?: any;
  pinnedAt: string;
  pinnedBy: string;
}

export type GroupPermissionScope = 'all' | 'admin_deputy' | 'admin';

export interface GroupSettings {
  invite: {
    code: string;
    approvalRequired: boolean;
  };
  permissions: {
    sendMedia: GroupPermissionScope;
    pinMessage: GroupPermissionScope;
    sendAnnouncement: GroupPermissionScope;
  };
  pinnedMessage: GroupPinnedMessage | null;
}

export interface Participant {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: "admin" | "deputy" | "member";
  joinedAt: string;
  nickname?: string;
  isPinned?: boolean;
  isMuted?: boolean;
  muteUntil?: string | null;
  labelIds?: string[];
  isHidden?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null; // null for private, group name for group
  avatarUrl: string | null;
  avatar?: string | null;
  background?: string;
  participants: Participant[];
  groupSettings?: GroupSettings;
  lastMessage: {
    content: any;
    senderId: string;
    senderName: string;
    type: MessageType;
    createdAt: string;
    metadata?: any;
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
  replyTo: {
    commentId: string;
    userId: string;
    content: string;
    author?: MomentAuthor | null;
  } | null;
  reactions: Array<{
    userId: string;
    userName: string;
    emoji: string;
    updatedAt?: string;
  }>;
  reactionCount: number;
  currentUserReaction: string | null;
  canDelete?: boolean;
  createdAt: string;
  updatedAt: string;
  author: MomentAuthor | null;
}

export interface MomentProfile {
  user: MomentAuthor | null;
  moments: Moment[];
}
