// Participant model (for DynamoDB, as a JS object)
// This is not a standalone table, but a schema for embedding in Conversation participants array

/**
 * Participant object structure:
 * {
 *   userId: String,
 *   role: String, // e.g. 'admin', 'deputy', 'member'
 *   nickname: String,
 *   joinedAt: Date (ISO string),
 *   lastRead: Date (ISO string)
 * }
 */

function createParticipant({ userId, role, nickname, joinedAt, lastRead }) {
  return {
    userId,
    role,
    nickname,
    joinedAt: joinedAt || new Date().toISOString(),
    lastRead: lastRead || null
  };
}

module.exports = { createParticipant };
