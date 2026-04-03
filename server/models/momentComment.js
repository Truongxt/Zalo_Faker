const { ulid } = require("ulid");

function createMomentComment({ momentId, userId, content }) {
  const now = new Date().toISOString();

  return {
    momentId,
    commentId: ulid(),
    userId: String(userId),
    content,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = { createMomentComment };
