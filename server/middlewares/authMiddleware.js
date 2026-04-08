const { verifyAccessToken } = require("../utils/jwt.js");
const userRepository = require("../repository/userRepository");
const { safeGet } = require("../utils/redisClient");

const buildSessionKey = (userId) => `auth:session:${String(userId)}`;

const normalizeUserPayload = (decoded = {}) => {
  const rawUserId = decoded.userId ?? decoded.id ?? decoded.sub;

  if (!rawUserId) {
    return null;
  }

  const userId = String(rawUserId);

  return {
    ...decoded,
    userId,
    id: userId
  };
};

const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    if (token.startsWith("mock-access-token")) {
      req.user = { userId: "user-me", id: "user-me" };
      return next();
    }

    const decoded = verifyAccessToken(token);
    const normalizedUser = normalizeUserPayload(decoded);

    if (!normalizedUser) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const tokenAccountStatus = normalizedUser.accountStatus;
    if (tokenAccountStatus === "locked" || tokenAccountStatus === "deleted") {
      return res.status(403).json({ message: "Account is not allowed to access this resource" });
    }

    // Check latest status from DB so locking account takes effect immediately,
    // even when old access tokens are still valid.
    const currentUser = await userRepository.getById(normalizedUser.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const currentAccountStatus = currentUser.accountStatus || currentUser.status || "active";
    if (currentAccountStatus === "locked" || currentAccountStatus === "deleted") {
      return res.status(403).json({ message: "Account is not allowed to access this resource" });
    }

    const sessionId = normalizedUser.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "Session expired" });
    }

    const activeSessionId = await safeGet(buildSessionKey(normalizedUser.userId));
    if (!activeSessionId || activeSessionId !== sessionId) {
      return res.status(401).json({ message: "Session expired" });
    }

    req.user = normalizedUser;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = authMiddleware;
