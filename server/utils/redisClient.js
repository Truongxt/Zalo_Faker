const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  // Thêm cấu hình tự động thử lại nhưng có giới hạn
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.warn("Redis: Max retries reached. Continuing without Redis.");
        return false; // Dừng thử lại sau 3 lần thất bại
      }
      return 1000; // Thử lại sau 1s
    }
  }
});

let isRedisReady = false;
const memoryStore = new Map();

const setMemoryValue = (key, value, ttlSeconds) => {
  const expiresAt =
    Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Date.now() + ttlSeconds * 1000
      : null;

  memoryStore.set(String(key), { value, expiresAt });
};

const getMemoryValue = (key) => {
  const item = memoryStore.get(String(key));
  if (!item) return null;

  if (item.expiresAt && Date.now() > item.expiresAt) {
    memoryStore.delete(String(key));
    return null;
  }

  return item.value;
};

const delMemoryValue = (key) => {
  memoryStore.delete(String(key));
};

redisClient.on("error", (err) => {
  console.error("Redis Error:", err.message);
  isRedisReady = false;
});

redisClient.on("connect", () => {
  console.log("Redis connecting...");
});

redisClient.on("ready", () => {
  console.log("Redis connected and ready");
  isRedisReady = true;
});

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err) {
    console.error("Could not connect to Redis:", err.message);
    isRedisReady = false;
  }
};

const safeGet = async (key) => {
  if (isRedisReady) {
    try {
      return await redisClient.get(key);
    } catch (err) {
      console.warn(`Redis safeGet fallback for key "${key}":`, err.message);
      isRedisReady = false;
    }
  }

  return getMemoryValue(key);
};

const safeSet = async (key, value, options = {}) => {
  const ttlSeconds =
    typeof options === "object" && options !== null ? options.EX : undefined;

  if (isRedisReady) {
    try {
      await redisClient.set(key, value, options);
      return;
    } catch (err) {
      console.warn(`Redis safeSet fallback for key "${key}":`, err.message);
      isRedisReady = false;
    }
  }

  setMemoryValue(key, value, ttlSeconds);
};

const safeDel = async (key) => {
  if (isRedisReady) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      console.warn(`Redis safeDel fallback for key "${key}":`, err.message);
      isRedisReady = false;
    }
  }

  delMemoryValue(key);
};

module.exports = {
  redisClient,
  connectRedis,
  safeGet,
  safeSet,
  safeDel,
  getIsRedisReady: () => isRedisReady,
};
