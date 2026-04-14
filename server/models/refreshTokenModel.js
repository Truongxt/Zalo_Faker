class RefreshToken {
  constructor({
    refreshToken,
    userId,
    platform,
    createdAt
  }) {
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.platform = platform || "unknown";
    this.createdAt = createdAt;
  }
}

module.exports = RefreshToken;