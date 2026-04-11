const { createMoment } = require("../models/moment");
const { createMomentComment } = require("../models/momentComment");
const { createMomentReaction } = require("../models/momentReaction");
const momentRepository = require("../repository/momentRepository");
const momentCommentRepository = require("../repository/momentCommentRepository");
const momentReactionRepository = require("../repository/momentReactionRepository");
const friendRepository = require("../repository/friendsRepository");
const userRepository = require("../repository/userRepository");
const conversationService = require("./conversationService");
const {
  deleteFiles,
  extractS3ObjectKey,
  getAccessibleFileUrls
} = require("./file.service");

const MOMENT_TYPES = {
  POST: "post",
  SHARE: "share"
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseFriendUserIds = (relations, userId) => {
  const currentUserId = String(userId);

  return [...new Set(
    relations
      .map((relation) => {
        const fromUserId = String(relation.fromUserId);
        const toUserId = String(relation.toUserId);
        return fromUserId === currentUserId ? toUserId : fromUserId;
      })
      .filter((friendId) => friendId && friendId !== currentUserId)
  )];
};

const sortMomentsDesc = (moments) =>
  moments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const dedupeMomentsById = (moments = []) => {
  const seen = new Set();

  return moments.filter((moment) => {
    const momentId = moment?.momentId;
    if (!momentId || seen.has(momentId)) {
      return false;
    }

    seen.add(momentId);
    return true;
  });
};

const normalizeMoment = (moment) => ({
  ...moment,
  mediaUrls: Array.isArray(moment.mediaUrls) ? moment.mediaUrls : [],
  reactionCount: Number(moment.reactionCount || 0),
  commentCount: Number(moment.commentCount || 0),
  shareCount: Number(moment.shareCount || 0)
});

const normalizeCommentReaction = (reaction) => ({
  userId: String(reaction.userId),
  emoji: reaction.emoji,
  updatedAt: reaction.updatedAt || new Date().toISOString()
});

const normalizeComment = (comment) => ({
  ...comment,
  replyTo: comment.replyTo
    ? {
        commentId: String(comment.replyTo.commentId),
        userId: String(comment.replyTo.userId),
        content: comment.replyTo.content || ""
      }
    : null,
  reactions: Array.isArray(comment.reactions)
    ? comment.reactions
        .filter((reaction) => reaction?.userId && reaction?.emoji)
        .map(normalizeCommentReaction)
    : []
});

const enrichUsers = async (userIds = []) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];
  const users = await Promise.all(uniqueUserIds.map((userId) => userRepository.getById(userId)));

  return users.reduce((acc, user) => {
    if (user) {
      acc[user.userId] = {
        userId: user.userId,
        userName: user.userName,
        avartarUrl: user.avartarUrl,
        email: user.email,
        phone: user.phone
      };
    }

    return acc;
  }, {});
};

const attachMomentMeta = async (moments, currentUserId) => {
  const normalized = moments.map(normalizeMoment);
  const reactionPairs = await Promise.all(
    normalized.map(async (moment) => [
      moment.momentId,
      await momentReactionRepository.getByUserAndMoment(currentUserId, moment.momentId)
    ])
  );
  const reactionMap = Object.fromEntries(reactionPairs);

  const userIds = [
    ...normalized.map((moment) => moment.authorId),
    ...normalized
      .map((moment) => moment.originalMomentSnapshot?.authorId)
      .filter(Boolean)
  ];
  const userMap = await enrichUsers(userIds);

  return Promise.all(
    normalized.map(async (moment) => ({
      ...moment,
      mediaUrls: await getAccessibleFileUrls(moment.mediaUrls),
      author: userMap[moment.authorId] || null,
      originalMomentSnapshot: moment.originalMomentSnapshot
        ? {
            ...moment.originalMomentSnapshot,
            mediaUrls: await getAccessibleFileUrls(moment.originalMomentSnapshot.mediaUrls),
            author: userMap[moment.originalMomentSnapshot.authorId] || null
          }
        : null,
      currentUserReaction: reactionMap[moment.momentId]?.emoji || null,
      isOwner: moment.authorId === String(currentUserId)
    }))
  );
};

const attachCommentMeta = async (comments, currentUserId, momentOwnerId = null) => {
  const normalized = comments.map(normalizeComment);
  const userIds = [
    ...normalized.map((comment) => comment.userId),
    ...normalized.map((comment) => comment.replyTo?.userId).filter(Boolean),
    ...normalized.flatMap((comment) => comment.reactions.map((reaction) => reaction.userId))
  ];
  const userMap = await enrichUsers(userIds);

  return normalized.map((comment) => {
    const reactions = comment.reactions.map((reaction) => ({
      ...reaction,
      userName: userMap[reaction.userId]?.userName || "Nguoi dung"
    }));

    return {
      ...comment,
      author: userMap[comment.userId] || null,
      replyTo: comment.replyTo
        ? {
            ...comment.replyTo,
            author: userMap[comment.replyTo.userId] || null
          }
        : null,
      reactions,
      reactionCount: reactions.length,
      canDelete:
        comment.userId === String(currentUserId) ||
        String(momentOwnerId || "") === String(currentUserId),
      currentUserReaction:
        reactions.find((reaction) => reaction.userId === String(currentUserId))?.emoji || null
    };
  });
};

const getFriendUserIds = async (userId) => {
  const relations = await friendRepository.getFriends(userId);
  return parseFriendUserIds(relations, userId);
};

const getMomentOrThrow = async (momentId) => {
  const moment = await momentRepository.getById(momentId);
  if (!moment) {
    throw createError("Moment not found", 404);
  }
  return normalizeMoment(moment);
};

const getMomentCommentOrThrow = async (momentId, commentId) => {
  const comment = await momentCommentRepository.getById(momentId, commentId);
  if (!comment) {
    throw createError("Comment not found", 404);
  }

  return normalizeComment(comment);
};

const ensureMomentVisible = async (moment, userId) => {
  const currentUserId = String(userId);
  if (moment.authorId === currentUserId) {
    return true;
  }

  const friendIds = await getFriendUserIds(currentUserId);
  if (!friendIds.includes(moment.authorId)) {
    throw createError("You do not have permission to view this moment", 403);
  }

  return true;
};

const ensureMomentOwner = (moment, userId) => {
  if (moment.authorId !== String(userId)) {
    throw createError("Only the owner can delete this moment", 403);
  }
};

const ensureCommentDeletePermission = (moment, comment, userId) => {
  const currentUserId = String(userId);

  if (
    comment.userId === currentUserId ||
    moment.authorId === currentUserId
  ) {
    return true;
  }

  throw createError("You do not have permission to delete this comment", 403);
};

const resolveRetainedMediaUrls = (existingMediaUrls = [], requestedMediaUrls = []) => {
  const requestedKeys = new Set(
    (Array.isArray(requestedMediaUrls) ? requestedMediaUrls : [])
      .map((mediaRef) => extractS3ObjectKey(mediaRef) || String(mediaRef || "").trim())
      .filter(Boolean)
  );

  return (Array.isArray(existingMediaUrls) ? existingMediaUrls : []).filter((mediaRef) => {
    const mediaKey = extractS3ObjectKey(mediaRef) || String(mediaRef || "").trim();
    return requestedKeys.has(mediaKey);
  });
};

const ensureValidMomentPayload = ({ content, mediaUrls }) => {
  const hasContent = Boolean(String(content || "").trim());
  const hasMedia = Array.isArray(mediaUrls) && mediaUrls.length > 0;

  if (!hasContent && !hasMedia) {
    throw createError("Moment content or media is required", 400);
  }
};

const incrementMomentField = async (moment, field, delta) => {
  const nextValue = Math.max(0, Number(moment[field] || 0) + delta);
  return momentRepository.update(moment.momentId, {
    [field]: nextValue,
    updatedAt: new Date().toISOString()
  });
};

const MomentService = {
  async createMoment({ userId, content, mediaUrls = [] }) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    ensureValidMomentPayload({ content, mediaUrls });

    const moment = createMoment({
      authorId: userId,
      content,
      mediaUrls,
      type: MOMENT_TYPES.POST
    });

    const created = await momentRepository.create(moment);
    const [enriched] = await attachMomentMeta([created], userId);
    return enriched;
  },

  async getFriendMoments(userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const friendIds = await getFriendUserIds(userId);
    const momentLists = await Promise.all(friendIds.map((friendId) => momentRepository.getByAuthorId(friendId)));
    const moments = sortMomentsDesc(dedupeMomentsById(momentLists.flat()));

    return attachMomentMeta(moments, userId);
  },

  async getMyProfile(userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const [user, moments] = await Promise.all([
      userRepository.getById(userId),
      momentRepository.getByAuthorId(userId)
    ]);

    return {
      user: user
        ? {
            userId: user.userId,
            userName: user.userName,
            avartarUrl: user.avartarUrl,
            email: user.email,
            phone: user.phone,
            status: user.status
          }
        : null,
      moments: await attachMomentMeta(moments, userId)
    };
  },

  async getUserProfile(targetUserId, requesterId) {
    if (!requesterId) {
      throw createError("Unauthorized", 401);
    }

    if (!targetUserId) {
      throw createError("User not found", 404);
    }

    if (String(targetUserId) === String(requesterId)) {
      return this.getMyProfile(requesterId);
    }

    const [user, friendIds, conversations] = await Promise.all([
      userRepository.getById(targetUserId),
      getFriendUserIds(requesterId),
      conversationService.getConversations(requesterId)
    ]);

    if (!user) {
      throw createError("User not found", 404);
    }

    const hasSharedConversation = (conversations || []).some((conversation) =>
      Array.isArray(conversation.participants) &&
      conversation.participants.some((participant) => String(participant.userId) === String(targetUserId))
    );

    if (!friendIds.includes(String(targetUserId)) && !hasSharedConversation) {
      throw createError("You do not have permission to view this profile", 403);
    }

    const moments = await momentRepository.getByAuthorId(targetUserId);

    return {
      user: {
        userId: user.userId,
        userName: user.userName,
        avartarUrl: user.avartarUrl,
        email: user.email,
        phone: user.phone,
        status: user.status
      },
      moments: await attachMomentMeta(moments, requesterId)
    };
  },

  async deleteMoment(momentId, userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const moment = await getMomentOrThrow(momentId);
    ensureMomentOwner(moment, userId);

    await Promise.all([
      momentCommentRepository.deleteByMomentId(momentId),
      momentReactionRepository.deleteByMomentId(momentId)
    ]);

    if (moment.type === MOMENT_TYPES.SHARE && moment.originalMomentId) {
      const originalMoment = await momentRepository.getById(moment.originalMomentId);
      if (originalMoment) {
        await incrementMomentField(normalizeMoment(originalMoment), "shareCount", -1);
      }
    }

    await momentRepository.delete(momentId);

    try {
      await deleteFiles(moment.mediaUrls);
    } catch (error) {
      console.warn("Failed to delete moment media from S3:", {
        momentId,
        error: error.message
      });
    }

    return {
      message: "Moment deleted successfully",
      momentId
    };
  },

  async updateMoment(momentId, userId, { content, retainMediaUrls = [], newMediaUrls = [] }) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const moment = await getMomentOrThrow(momentId);
    ensureMomentOwner(moment, userId);

    const retainedMediaUrls = resolveRetainedMediaUrls(moment.mediaUrls, retainMediaUrls);
    const nextMediaUrls = [...retainedMediaUrls, ...(Array.isArray(newMediaUrls) ? newMediaUrls : [])];
    const nextContent = content !== undefined ? content : moment.content;

    ensureValidMomentPayload({
      content: nextContent,
      mediaUrls: nextMediaUrls
    });

    const removedMediaUrls = moment.mediaUrls.filter(
      (mediaRef) => !retainedMediaUrls.includes(mediaRef)
    );

    const updated = await momentRepository.update(momentId, {
      content: nextContent,
      mediaUrls: nextMediaUrls,
      updatedAt: new Date().toISOString()
    });

    if (removedMediaUrls.length > 0) {
      try {
        await deleteFiles(removedMediaUrls);
      } catch (error) {
        console.warn("Failed to delete removed moment media from S3:", {
          momentId,
          error: error.message
        });
      }
    }

    const [enriched] = await attachMomentMeta([updated], userId);
    return enriched;
  },

  async reactToMoment(momentId, userId, emoji) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!emoji || !String(emoji).trim()) {
      throw createError("emoji is required", 400);
    }

    const moment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(moment, userId);

    const existingReaction = await momentReactionRepository.getByUserAndMoment(userId, momentId);

    if (existingReaction && existingReaction.emoji === emoji) {
      await momentReactionRepository.delete(userId, momentId);
      await incrementMomentField(moment, "reactionCount", -1);

      return {
        message: "Reaction removed successfully",
        reaction: null
      };
    }

    const reaction = existingReaction
      ? {
          ...existingReaction,
          emoji,
          updatedAt: new Date().toISOString()
        }
      : createMomentReaction({ momentId, userId, emoji });

    await momentReactionRepository.createOrUpdate(reaction);

    if (!existingReaction) {
      await incrementMomentField(moment, "reactionCount", 1);
    }

    return {
      message: existingReaction ? "Reaction updated successfully" : "Reaction added successfully",
      reaction
    };
  },

  async commentMoment(momentId, userId, content, replyToCommentId = null) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!content || !String(content).trim()) {
      throw createError("Comment content is required", 400);
    }

    const moment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(moment, userId);

    let replyTo = null;

    if (replyToCommentId) {
      const targetComment = await getMomentCommentOrThrow(momentId, replyToCommentId);
      replyTo = {
        commentId: targetComment.commentId,
        userId: targetComment.userId,
        content: targetComment.content
      };
    }

    const comment = createMomentComment({
      momentId,
      userId,
      content,
      replyTo
    });

    await momentCommentRepository.create(comment);
    await incrementMomentField(moment, "commentCount", 1);
    const [enriched] = await attachCommentMeta([comment], userId, moment.authorId);
    return enriched;
  },

  async getMomentComments(momentId, userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const moment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(moment, userId);

    const comments = await momentCommentRepository.getByMomentId(momentId);
    return attachCommentMeta(comments, userId, moment.authorId);
  },

  async reactToComment(momentId, commentId, userId, emoji) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!emoji || !String(emoji).trim()) {
      throw createError("emoji is required", 400);
    }

    const moment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(moment, userId);

    const comment = await getMomentCommentOrThrow(momentId, commentId);
    const existingReactionIndex = comment.reactions.findIndex(
      (reaction) => reaction.userId === String(userId)
    );

    if (existingReactionIndex >= 0 && comment.reactions[existingReactionIndex].emoji === emoji) {
      comment.reactions.splice(existingReactionIndex, 1);
    } else if (existingReactionIndex >= 0) {
      comment.reactions[existingReactionIndex] = normalizeCommentReaction({
        ...comment.reactions[existingReactionIndex],
        emoji,
        updatedAt: new Date().toISOString()
      });
    } else {
      comment.reactions.push(
        normalizeCommentReaction({
          userId,
          emoji,
          updatedAt: new Date().toISOString()
        })
      );
    }

    comment.updatedAt = new Date().toISOString();
    const updated = await momentCommentRepository.update(comment);
    const [enriched] = await attachCommentMeta([updated], userId, moment.authorId);
    return enriched;
  },

  async deleteComment(momentId, commentId, userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const moment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(moment, userId);

    const comment = await getMomentCommentOrThrow(momentId, commentId);
    ensureCommentDeletePermission(moment, comment, userId);

    await momentCommentRepository.delete(momentId, commentId);
    await incrementMomentField(moment, "commentCount", -1);

    return {
      message: "Comment deleted successfully",
      momentId,
      commentId
    };
  },

  async shareMoment(momentId, userId, caption) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const originalMoment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(originalMoment, userId);

    const sharedMoment = createMoment({
      authorId: userId,
      content: caption || "",
      mediaUrls: [],
      type: MOMENT_TYPES.SHARE,
      originalMomentId: originalMoment.momentId,
      originalMomentSnapshot: {
        momentId: originalMoment.momentId,
        authorId: originalMoment.authorId,
        content: originalMoment.content,
        mediaUrls: originalMoment.mediaUrls,
        type: originalMoment.type,
        createdAt: originalMoment.createdAt
      }
    });

    const created = await momentRepository.create(sharedMoment);
    await incrementMomentField(originalMoment, "shareCount", 1);

    const [enriched] = await attachMomentMeta([created], userId);
    return enriched;
  },

  async getReactedMoments(userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const reactions = await momentReactionRepository.getByUserId(userId);
    const moments = await momentRepository.getByIds(reactions.map((reaction) => reaction.momentId));
    const visibleMoments = [];

    for (const moment of moments) {
      try {
        await ensureMomentVisible(normalizeMoment(moment), userId);
        visibleMoments.push(moment);
      } catch (error) {
        if (error.statusCode !== 403) {
          throw error;
        }
      }
    }

    return attachMomentMeta(sortMomentsDesc(visibleMoments), userId);
  }
};

module.exports = MomentService;
