const { createMoment } = require("../models/moment");
const { createMomentComment } = require("../models/momentComment");
const { createMomentReaction } = require("../models/momentReaction");
const momentRepository = require("../repository/momentRepository");
const momentCommentRepository = require("../repository/momentCommentRepository");
const momentReactionRepository = require("../repository/momentReactionRepository");
const friendRepository = require("../repository/friendsRepository");
const userRepository = require("../repository/userRepository");

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

  return relations.map((relation) => {
    const fromUserId = String(relation.fromUserId);
    const toUserId = String(relation.toUserId);
    return fromUserId === currentUserId ? toUserId : fromUserId;
  });
};

const sortMomentsDesc = (moments) =>
  moments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const normalizeMoment = (moment) => ({
  ...moment,
  mediaUrls: Array.isArray(moment.mediaUrls) ? moment.mediaUrls : [],
  reactionCount: Number(moment.reactionCount || 0),
  commentCount: Number(moment.commentCount || 0),
  shareCount: Number(moment.shareCount || 0)
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

  return normalized.map((moment) => ({
    ...moment,
    author: userMap[moment.authorId] || null,
    originalMomentSnapshot: moment.originalMomentSnapshot
      ? {
          ...moment.originalMomentSnapshot,
          author: userMap[moment.originalMomentSnapshot.authorId] || null
        }
      : null,
    currentUserReaction: reactionMap[moment.momentId]?.emoji || null,
    isOwner: moment.authorId === String(currentUserId)
  }));
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
    const moments = sortMomentsDesc(momentLists.flat());

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

    return {
      message: "Moment deleted successfully",
      momentId
    };
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

  async commentMoment(momentId, userId, content) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    if (!content || !String(content).trim()) {
      throw createError("Comment content is required", 400);
    }

    const moment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(moment, userId);

    const comment = createMomentComment({
      momentId,
      userId,
      content
    });

    await momentCommentRepository.create(comment);
    await incrementMomentField(moment, "commentCount", 1);

    const userMap = await enrichUsers([userId]);

    return {
      ...comment,
      author: userMap[String(userId)] || null
    };
  },

  async getMomentComments(momentId, userId) {
    if (!userId) {
      throw createError("Unauthorized", 401);
    }

    const moment = await getMomentOrThrow(momentId);
    await ensureMomentVisible(moment, userId);

    const comments = await momentCommentRepository.getByMomentId(momentId);
    const userMap = await enrichUsers(comments.map((comment) => comment.userId));

    return comments.map((comment) => ({
      ...comment,
      author: userMap[comment.userId] || null
    }));
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
