const { ulid } = require("ulid");

function createMoment({
  authorId,
  content,
  mediaUrls = [],
  type = "post",
  originalMomentId = null,
  originalMomentSnapshot = null
}) {
  const now = new Date().toISOString();

  return {
    momentId: ulid(),
    authorId: String(authorId),
    type,
    content: content || "",
    mediaUrls,
    originalMomentId,
    originalMomentSnapshot,
    reactionCount: 0,
    commentCount: 0,
    shareCount: 0,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = { createMoment };
