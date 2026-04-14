// Participant model (for DynamoDB, as a JS object)
// This is not a standalone table, but a schema for embedding in Conversation participants array

/**
 * Participant object structure:
 * {
 *   userId: String,
 *   role: String, // e.g. 'admin', 'deputy', 'member'
 *   nickname: String,
 *   joinedAt: Date (ISO string),
 *   lastRead: Date (ISO string),
 *   isPinned: Boolean,
 *   isMuted: Boolean,
 *   muteUntil: Date (ISO string) | null
 * }
 */

function createParticipant({ userId, role, nickname, joinedAt, lastRead, isPinned, isMuted, muteUntil }) {
  return {
    userId,
    role,
    nickname: nickname || "",
    joinedAt: joinedAt || new Date().toISOString(),
    lastRead: lastRead || null,
    isPinned: isPinned || false,
    isMuted: isMuted || false,
    muteUntil: muteUntil || null
  };
}

module.exports = { createParticipant };
