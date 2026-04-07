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

module.exports = {
  redisClient,
  connectRedis,
  getIsRedisReady: () => isRedisReady,
};