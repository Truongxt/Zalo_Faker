class LoginHistory {
  constructor({
    userId,
    loginId,
    loginAt,
    platform,
    deviceInfo,
    ipAddress,
  }) {
    this.userId = userId;
    this.loginId = loginId;
    this.loginAt = loginAt;
    this.platform = platform;       // "mobile" | "web"
    this.deviceInfo = deviceInfo;   // e.g. "iPhone 15 Pro / iOS 17.4" or user-agent string
    this.ipAddress = ipAddress;
  }
}

module.exports = LoginHistory;
