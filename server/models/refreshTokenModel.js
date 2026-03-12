class RefreshToken {
  constructor({
    refreshToken,
    userId,
    createdAt
  }) {
    this.refreshToken = refreshToken;
    this.userId = userId;
    this.createdAt = createdAt;
  }
}

module.exports = RefreshToken;