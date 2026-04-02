// Participant model (for DynamoDB, as a JS object)
// This is not a standalone table, but a schema for embedding in Conversation participants array

/**
 * Participant object structure:
 * {
 *   userId: String,
 *   role: String, // e.g. 'admin', 'member'
 *   nickname: String,
 *   joinedAt: Date (ISO string),
 *   lastRead: Date (ISO string),
 *   isPinned: Boolean,
 *   isMuted: Boolean
 * }
 */

function createParticipant({ userId, role, nickname, joinedAt, lastRead, isPinned, isMuted }) {
  return {
    userId,
    role,
    nickname: nickname || "",
    joinedAt: joinedAt || new Date().toISOString(),
    lastRead: lastRead || null,
    isPinned: isPinned || false,
    isMuted: isMuted || false
  };
}

module.exports = { createParticipant };
