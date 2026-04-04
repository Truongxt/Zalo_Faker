function createMomentReaction({ momentId, userId, emoji }) {
  const now = new Date().toISOString();

  return {
    userId: String(userId),
    momentId,
    emoji,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = { createMomentReaction };
