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

export interface MomentReaction {
  userId: string;
  momentId: string;
  emoji: string;
  updatedAt: string;
  user: MomentAuthor | null;
}
