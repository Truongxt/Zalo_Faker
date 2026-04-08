import type { Moment, MomentComment } from '@/types/moment';

export const REACTION_OPTIONS = [
  { key: 'like', label: 'Thích', icon: '👍' },
  { key: 'love', label: 'Yêu thích', icon: '❤️' },
  { key: 'haha', label: 'Haha', icon: '😂' },
  { key: 'wow', label: 'Wow', icon: '😮' },
  { key: 'sad', label: 'Buồn', icon: '😢' },
  { key: 'angry', label: 'Giận dữ', icon: '😡' },
] as const;

export const getReactionOption = (reactionKey?: string | null) =>
  REACTION_OPTIONS.find((option) => option.key === reactionKey) || null;

export const summarizeCommentReactions = (
  reactions: MomentComment['reactions'] = [],
) => {
  const counts = reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([emoji, count]) => ({
    emoji: getReactionOption(emoji)?.icon || emoji,
    count,
  }));
};

export const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  const cleanUrl = url.split(/[?#]/)[0].toLowerCase();
  return ['.mp4', '.mov', '.webm', '.m4v', '.ogv'].some((extension) =>
    cleanUrl.endsWith(extension),
  );
};

export const applyMomentReactionLocally = (
  moment: Moment,
  reactionKey: string,
): Moment => {
  const isRemovingReaction = moment.currentUserReaction === reactionKey;
  const isReplacingReaction = Boolean(moment.currentUserReaction) && !isRemovingReaction;
  const reactionDelta = isRemovingReaction ? -1 : isReplacingReaction ? 0 : 1;

  return {
    ...moment,
    currentUserReaction: isRemovingReaction ? null : reactionKey,
    reactionCount: Math.max(0, moment.reactionCount + reactionDelta),
  };
};
