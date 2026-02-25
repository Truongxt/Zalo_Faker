// LastMessage model (for embedding in Conversation)
/**
 * LastMessage object structure:
 * {
 *   content: String,
 *   type: String, // e.g. 'text', 'image', 'video', 'file'
 *   senderId: String,
 *   timestamp: Date (ISO string)
 * }
 */

function createLastMessage({ content, type, senderId, timestamp }) {
  return {
    content: content || '',
    type: type || 'text',
    senderId: senderId || '',
    timestamp: timestamp || new Date().toISOString()
  };
}

module.exports = { createLastMessage };
