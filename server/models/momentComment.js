const { ulid } = require("ulid");

function createMomentComment({ momentId, userId, content, replyTo = null }) {
  const now = new Date().toISOString();

  return {
    momentId,
    commentId: ulid(),
    userId: String(userId),
    content,
    replyTo,
    reactions: [],
    createdAt: now,
    updatedAt: now
  };
}

module.exports = { createMomentComment };
