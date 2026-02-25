// ReadReceipt model (for embedding in Message)
/**
 * ReadReceipt object structure:
 * {
 *   userId: String,
 *   readAt: Date (ISO string)
 * }
 */

function createReadReceipt({ userId, readAt }) {
  return {
    userId,
    readAt: readAt || new Date().toISOString()
  };
}

module.exports = { createReadReceipt };
