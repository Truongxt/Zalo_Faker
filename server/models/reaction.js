// Reaction model (for embedding in Message)
/**
 * Reaction object structure:
 * {
 *   userId: String,
 *   emoji: String
 * }
 */

function createReaction({ userId, emoji }) {
  return {
    userId,
    emoji
  };
}

module.exports = { createReaction };
