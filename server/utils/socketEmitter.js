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
};
