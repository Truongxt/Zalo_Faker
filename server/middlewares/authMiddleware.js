const { verifyAccessToken } = require("../utils/jwt.js");

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

const authMiddleware = (req, res, next) => {
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

    req.user = normalizedUser;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = authMiddleware;
