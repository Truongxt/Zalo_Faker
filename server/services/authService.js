const { verifyRefreshToken, signAccessToken } = require("../utils/jwt");
const RefreshTokenModel = require("../models/refreshTokenModel");

const refreshAccessToken = async refreshToken => {

  if (!refreshToken) {
    throw new Error("Refresh token required");
  }

  // 1️⃣ kiểm tra token tồn tại DB
  const stored = await RefreshTokenModel.get(refreshToken);
  if (!stored) {
    throw new Error("Invalid refresh token");
  }

  // 2️⃣ verify JWT
  const decoded = verifyRefreshToken(refreshToken);

  // 3️⃣ tạo access token mới
  const newAccessToken = signAccessToken({
    userId: decoded.userId,
    email: decoded.email
  });

  return { accessToken: newAccessToken };
};

module.exports = { refreshAccessToken };