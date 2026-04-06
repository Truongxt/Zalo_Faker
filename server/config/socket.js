const { Server } = require("socket.io");
const messageService = require("../services/messageService");
const conversationModel = require("../models/conversation");
const GroupService = require("../services/groupService");
const userRepository = require("../repository/userRepository");
const { verifyAccessToken } = require("../utils/jwt");
const { redisClient } = require("../utils/redisClient");

// ─── Redis key helpers ───────────────────────────────────────────────
const presenceKey = (userId, platform) => `presence:${userId}:${platform}`;
const allPresencePattern = (userId) => `presence:${userId}:*`;

module.exports = (socketConfig) => {
  const io = new Server(socketConfig, {
    cors: { origin: "*" },
  });

  // ─── Middleware: JWT Authentication ───────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = verifyAccessToken(token);
      if (!decoded || !decoded.userId) {
        return next(new Error("Authentication error: Invalid token"));
      }

      // Check account status from JWT payload
      const accountStatus = decoded.accountStatus || "active";
      if (accountStatus === "locked" || accountStatus === "deleted") {
        return next(new Error("Authentication error: Account is not active"));
      }

      // Attach user info to socket
      socket.userId = String(decoded.userId);
      socket.userEmail = decoded.email;
      // Platform: client sends "mobile" or "web", default to "web"
      socket.platform = socket.handshake.auth?.platform || "web";

      next();
    } catch (err) {
      return next(new Error("Authentication error: " + (err.message || "Token verification failed")));
    }
  });

  // ─── Helper: Check if user is online on any platform ──────────────
  const isUserOnline = async (userId) => {
    try {
      // Scan for all presence keys of this user
      const keys = [];
      for await (const key of redisClient.scanIterator({ MATCH: allPresencePattern(userId), COUNT: 10 })) {
        keys.push(key);
      }
      return keys.length > 0;
    } catch (err) {
      console.error("isUserOnline error:", err);
      return false;
    }
  };

  // ─── Connection ───────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const { userId, platform } = socket;
    console.log(`Socket connected: ${socket.id} | User: ${userId} | Platform: ${platform}`);

    // ── Single-device-per-platform enforcement ──────────────────────
    // Check if there's already a socket for this user on the same platform
    try {
      const key = presenceKey(userId, platform);
      const existingSocketId = await redisClient.get(key);

      if (existingSocketId && existingSocketId !== socket.id) {
        // Force disconnect the old socket on the same platform
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          existingSocket.emit("session:force_logout", {
            reason: `Tài khoản của bạn đã được đăng nhập trên một thiết bị ${platform === "mobile" ? "di động" : "web"} khác.`,
            platform,
          });
          // Give client a moment to handle the event before disconnecting
          setTimeout(() => {
            existingSocket.disconnect(true);
          }, 500);
        }
        console.log(`Force disconnected old ${platform} session for user ${userId} (socket: ${existingSocketId})`);
      }

      // ── Register this socket in Redis ────────────────────────────
      const wasOnline = await isUserOnline(userId);

      // Store: presence:{userId}:{platform} = socketId (no expiry, we clean up on disconnect)
      await redisClient.set(key, socket.id);

      // Update DB presence
      await userRepository.updateUser(String(userId), {
        presenceStatus: "online",
      }).catch((err) => console.warn("Failed to update presenceStatus to online:", err?.message));

      // If user was not online before (first device connects), broadcast
      if (!wasOnline) {
        socket.broadcast.emit("presence:online", { userId });
      }

      console.log(`User ${userId} is online (${platform})`);
    } catch (err) {
      console.error("Connection presence setup error:", err);
    }

    // ── 2. Join/Leave rooms ─────────────────────────────────────────
    socket.on("room:join", (conversationId) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined room ${conversationId}`);
    });

    socket.on("room:leave", (conversationId) => {
      socket.leave(conversationId);
    });

    // ── 3. Send message ─────────────────────────────────────────────
    socket.on("chat:send", async (data, callback) => {
      try {
        const { conversationId, type, content, replyTo, metadata } = data;
        const actualSenderId = socket.userId;

        if (!actualSenderId) {
          return callback && callback({ success: false, error: "Unauthorized socket" });
        }

        // Permission check
        const { getConversation } = require("../services/conversationService");
        const conv = await getConversation(conversationId);
        if (!conv) {
          return callback && callback({ success: false, error: "Conversation not found" });
        }
        if (!conv.participants || !conv.participants.some(p => p.userId === actualSenderId)) {
          return callback && callback({ success: false, error: "Not a member of this conversation" });
        }

        if (conv.type === "group") {
          GroupService.ensureCanSendMessage(conv, {
            userId: actualSenderId,
            type: type || "text",
            metadata
          });
        }

        // Save to DynamoDB
        const saved = await messageService.createMessage({
          conversationId,
          senderId: actualSenderId,
          type: type || "text",
          content,
          metadata: metadata || null,
          replyTo: replyTo || null,
          reactions: [],
          readBy: [],
          isDeleted: false,
        });

        // Update lastMessage of conversation
        await conversationModel.updateConversation(conversationId, {
          lastMessage: {
            content: metadata?.isAnnouncement
              ? `[Thông báo] ${content.text || ""}`.trim()
              : content.text || (type === 'image' ? '[Hình ảnh]' : type === 'video' ? '[Video]' : type === 'voice' ? '[Tin nhắn thoại]' : type === 'sticker' ? '[Nhãn dán]' : '[File]'),
            type: type || "text",
            senderId: actualSenderId,
            timestamp: saved.createdAt,
          },
        });

        const message = { ...saved, id: saved._id };

        // Broadcast to everyone in the room (including sender)
        io.to(conversationId).emit("chat:message", message);

        if (callback) callback({ success: true, message });

      } catch (err) {
        console.error("chat:send error:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ── 4. Typing indicator ─────────────────────────────────────────
    socket.on("chat:typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("chat:typing", { conversationId, userId });
    });

    socket.on("chat:stop_typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("chat:stop_typing", { conversationId, userId });
    });

    // ── 5. Read receipt ────────────────────────────────────────────
    socket.on("chat:read", async ({ conversationId, messageId, userId }) => {
      try {
        if (messageId && userId) {
          const message = await messageService.getMessage(messageId);
          if (message) {
            let newReadBy = [...(message.readBy || [])];
            if (!newReadBy.some(r => r.userId === userId)) {
              newReadBy.push({ userId, readAt: new Date().toISOString() });
              await messageService.updateMessage(messageId, { readBy: newReadBy });
            }
          }
        }

        socket.to(conversationId).emit("chat:read", {
          conversationId,
          messageId,
          userId,
        });
      } catch (err) {
        console.error("chat:read error:", err);
      }
    });

    // ── 6. Disconnect ──────────────────────────────────────────────
    socket.on("disconnect", async () => {
      if (!socket.userId) return;

      try {
        const key = presenceKey(socket.userId, socket.platform);

        // Only remove if the stored socketId matches this socket
        // (avoids race condition where a new socket already replaced this one)
        const storedSocketId = await redisClient.get(key);
        if (storedSocketId === socket.id) {
          await redisClient.del(key);
        }

        // Check if user is still online on another platform
        const stillOnline = await isUserOnline(socket.userId);

        if (!stillOnline) {
          // User is fully offline
          await userRepository.updateUser(String(socket.userId), {
            presenceStatus: "offline",
            lastActiveAt: new Date().toISOString(),
          }).catch((err) => console.warn("Failed to update presenceStatus to offline:", err?.message));

          socket.broadcast.emit("presence:offline", { userId: socket.userId });
          console.log(`User ${socket.userId} is offline`);
        } else {
          console.log(`User ${socket.userId} disconnected ${socket.platform} but still online on another platform`);
        }
      } catch (err) {
        console.error("disconnect presence cleanup error:", err);
      }
    });

    // ── Reaction ────────────────────────────────────────────────────
    socket.on("chat:reaction", async (data, callback) => {
      try {
        const { messageId, conversationId, userId, emoji } = data;

        const message = await messageService.getMessage(messageId);
        if (!message) {
          return callback?.({ success: false, error: "Tin nhắn không tồn tại" });
        }

        let newReactions = [...(message.reactions || [])];
        const existingReactionIndex = newReactions.findIndex(r => r.userId === userId);

        if (existingReactionIndex !== -1) {
          if (newReactions[existingReactionIndex].emoji === emoji) {
            newReactions.splice(existingReactionIndex, 1);
          } else {
            newReactions[existingReactionIndex].emoji = emoji;
          }
        } else {
          newReactions.push({ userId, emoji });
        }

        await messageService.updateMessage(messageId, { reactions: newReactions });

        io.to(conversationId).emit("chat:reaction", {
          messageId,
          reactions: newReactions
        });

        if (callback) callback({ success: true });

      } catch (err) {
        console.error("chat:reaction error:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ── Recall message ──────────────────────────────────────────────
    socket.on("chat:recall", async (data, callback) => {
      try {
        const { messageId, conversationId, senderId } = data;

        const message = await messageService.getMessage(messageId);
        if (!message) {
          return callback?.({ success: false, error: "Tin nhắn không tồn tại" });
        }
        if (message.senderId !== senderId) {
          return callback?.({ success: false, error: "Bạn không có quyền thu hồi tin nhắn này" });
        }

        await messageService.updateMessage(messageId, { isDeleted: true });

        io.to(conversationId).emit("chat:recalled", {
          messageId,
          conversationId,
        });

        callback?.({ success: true });

      } catch (err) {
        console.error("chat:recall error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    // ── 7. Video Call Signaling ──────────────────────────────────────
    // Helper: find socketId for a userId (check both platforms)
    const getSocketIdForUser = async (targetUserId) => {
      for (const plat of ["mobile", "web"]) {
        const sid = await redisClient.get(presenceKey(targetUserId, plat));
        if (sid) return sid;
      }
      return null;
    };

    socket.on("video:call-user", async (data) => {
      const toSocketId = await getSocketIdForUser(String(data.toUserId));
      if (toSocketId) {
        io.to(toSocketId).emit("video:incoming-call", data);
      } else {
        socket.emit("video:user-offline", { toUserId: data.toUserId });
      }
    });

    socket.on("video:answer-call", async (data) => {
      const toSocketId = await getSocketIdForUser(String(data.toUserId));
      if (toSocketId) {
        io.to(toSocketId).emit("video:call-answered", data);
      }
    });

    socket.on("video:reject-call", async (data) => {
      const toSocketId = await getSocketIdForUser(String(data.toUserId));
      if (toSocketId) {
        io.to(toSocketId).emit("video:call-rejected", data);
      }
    });

    socket.on("video:end-call", async (data) => {
      const toSocketId = await getSocketIdForUser(String(data.toUserId));
      if (toSocketId) {
        io.to(toSocketId).emit("video:call-ended", data);
      }
    });

    // ── 8. Get online users ─────────────────────────────────────────
    socket.on("presence:get_online_users", async (userIds, callback) => {
      try {
        const onlineStatuses = {};
        for (const uid of userIds) {
          onlineStatuses[uid] = await isUserOnline(uid);
        }
        if (callback) callback({ success: true, onlineStatuses });
      } catch (err) {
        console.error("presence:get_online_users error:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });
  });

  return io;
};
