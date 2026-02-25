// Content model (for embedding in Message)
/**
 * Content object structure:
 * {
 *   text: String,
 *   mediaUrl: String,
 *   thumbnail: String,
 *   fileName: String,
 *   fileSize: Number
 * }
 */

function createContent({ text, mediaUrl, thumbnail, fileName, fileSize }) {
  return {
    text: text || '',
    mediaUrl: mediaUrl || '',
    thumbnail: thumbnail || '',
    fileName: fileName || '',
    fileSize: fileSize || 0
  };
}

module.exports = { createContent };
