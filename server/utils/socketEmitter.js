const { redisClient } = require("./redisClient");

let ioInstance = null;

const PRESENCE_PLATFORMS = ["mobile", "web"];
const presenceKey = (userId, platform) => `presence:${userId}:${platform}`;

function setSocketIO(io) {
  ioInstance = io;
}

function getSocketIO() {
  return ioInstance;
}

const normalizePlatform = (platform) => {
  const normalized = String(platform || "").trim().toLowerCase();
  if (normalized === "mobile" || normalized === "android" || normalized === "ios") {
    return "mobile";
  }
  if (normalized === "web" || normalized === "browser") {
    return "web";
  }
  return "unknown";
};

async function forceLogoutSessions({
  userId,
  sessionIds = [],
  platforms = [],
  reason = "",
} = {}) {
  if (!ioInstance || !userId) return 0;

  const normalizedUserId = String(userId);
  const targetSessionIds = new Set(
    (Array.isArray(sessionIds) ? sessionIds : [])
      .map((sessionId) => String(sessionId || "").trim())
      .filter(Boolean),
  );
  const targetPlatforms = new Set(
    (Array.isArray(platforms) ? platforms : [])
      .map((platform) => normalizePlatform(platform))
      .filter(Boolean),
  );

  const roomId = `user:${normalizedUserId}`;
  const roomMembers = ioInstance.sockets?.adapter?.rooms?.get(roomId);
  if (!roomMembers || roomMembers.size === 0) return 0;

  let affectedSockets = 0;

  for (const socketId of roomMembers) {
    const socket = ioInstance.sockets.sockets.get(socketId);
    if (!socket) continue;

    const currentSessionId = String(socket.sessionId || "").trim();
    const currentPlatform = normalizePlatform(socket.platform);
    const matchesSession =
      targetSessionIds.size > 0 && targetSessionIds.has(currentSessionId);
    const matchesPlatform =
      targetSessionIds.size === 0
      && targetPlatforms.size > 0
      && targetPlatforms.has(currentPlatform);

    if (targetSessionIds.size > 0 && !matchesSession) {
      continue;
    }
    if (targetSessionIds.size === 0 && targetPlatforms.size > 0 && !matchesPlatform) {
      continue;
    }

    affectedSockets += 1;

    socket.emit("session:force_logout", {
      reason:
        reason || "Phiên đăng nhập của bạn đã bị đăng xuất từ xa.",
      revokedRemotely: true,
    });

    setTimeout(() => {
      if (socket.connected) {
        socket.disconnect(true);
      }
    }, 300);
  }

  return affectedSockets;
}

async function emitToUser(userId, eventName, payload) {
  if (!ioInstance || !userId) return false;

  try {
    const socketIds = [];

    for (const platform of PRESENCE_PLATFORMS) {
      const socketId = await redisClient.get(presenceKey(String(userId), platform));
      if (socketId) socketIds.push(socketId);
    }

    if (socketIds.length === 0) return false;

    for (const socketId of socketIds) {
      ioInstance.to(socketId).emit(eventName, payload);
    }

    return true;
  } catch (err) {
    console.warn("emitToUser error:", err?.message || err);
    return false;
  }
}

module.exports = {
  setSocketIO,
  getSocketIO,
  emitToUser,
  forceLogoutSessions,
};
