const { Server } = require("socket.io");
const messageService = require("../services/messageService");
const conversationService = require("../services/conversationService");
const conversationModel = require("../models/conversation");
const GroupService = require("../services/groupService");
const friendService = require("../services/friendService");
const userRepository = require("../repository/userRepository");
const { verifyAccessToken } = require("../utils/jwt");
const { redisClient, getIsRedisReady, safeGet } = require("../utils/redisClient");

const PRESENCE_TTL_SECONDS = 90;
const PRESENCE_HEARTBEAT_MS = 30000;

const presenceKey = (userId, platform) => `presence:${userId}:${platform}`;
const allPresencePattern = (userId) => `presence:${userId}:*`;
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

const sessionKey = (userId, platform = "unknown") =>
  `auth:session:${String(userId)}:${normalizePlatform(platform)}`;
const legacySessionKey = (userId) => `auth:session:${String(userId)}`;

const normalizeUserIdValue = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.userId || value.id || value._id || value.value || "").trim();
  }
  return String(value).trim();
};

const MEDIA_FALLBACK_BY_TYPE = {
  image: "[Hinh anh]",
  video: "[Video]",
  voice: "[Tin nhan thoai]",
  sticker: "[Nhan dan]",
  file: "[File]",
  call: "[Cuoc goi]",
};

const toRoomId = (conversationId) => `conv:${String(conversationId)}`;

const normalizeMessage = (message) => ({
  ...message,
  id: message?._id || message?.id,
  reactions: Array.isArray(message?.reactions) ? message.reactions : [],
  readBy: Array.isArray(message?.readBy) ? message.readBy : [],
  isDeleted: Boolean(message?.isDeleted),
});

const normalizeCallType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "audio" || normalized === "voice") return "audio";
  return "";
};

const normalizeCallStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized === "ended" ? "finished" : normalized;
};

const parseCallPayloadFromObject = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const callType = normalizeCallType(payload.callType);
  const status = normalizeCallStatus(payload.status || payload.callStatus);
  if (!callType || !status) return null;
  return { callType, status };
};

const parseCallPayload = (content) => {
  if (!content) return null;

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

    try {
      return parseCallPayloadFromObject(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (typeof content !== "object" || Array.isArray(content)) return null;

  const direct = parseCallPayloadFromObject(content);
  if (direct) return direct;

  const nestedText =
    typeof content.text === "string"
      ? content.text
      : typeof content.message === "string"
      ? content.message
      : typeof content.content === "string"
      ? content.content
      : "";

  return nestedText ? parseCallPayload(nestedText) : null;
};

const getCallPreviewText = (callPayload) => {
  const suffix = callPayload.callType === "video" ? " video" : "";
  if (callPayload.status === "finished") return `Cuoc goi${suffix}`;
  if (callPayload.status === "missed") return `Cuoc goi nho${suffix}`;
  if (callPayload.status === "rejected") return "Cuoc goi bi tu choi";
  if (callPayload.status === "cancelled") return "Cuoc goi da huy";
  return callPayload.callType === "video" ? "Cuoc goi video" : "Cuoc goi";
};

const resolveCallStatus = (status, fallback = "finished") => {
  return normalizeCallStatus(status) || fallback;
};

const resolveCallType = (callType, fallback = "audio") => {
  return normalizeCallType(callType) || fallback;
};

const resolveCallDuration = (duration) => {
  if (typeof duration !== "number" || !Number.isFinite(duration)) return 0;
  return Math.max(0, Math.floor(duration));
};

const getLastMessageText = ({ type, content, metadata }) => {
  const callPayload = parseCallPayload(content);
  const contentText =
    typeof content === "string"
      ? content
      : typeof content?.text === "string"
      ? content.text
      : "";

  if (metadata?.isAnnouncement) {
    return `[Thong bao] ${contentText}`.trim();
  }

  if (type === "call" || callPayload) {
    return getCallPreviewText(callPayload || { callType: "audio", status: "finished" });
  }

  if (contentText) return contentText;
  return MEDIA_FALLBACK_BY_TYPE[type] || "[Tin nhan]";
};

module.exports = (socketConfig) => {
  const io = new Server(socketConfig, {
    cors: { origin: "*" },
  });

  const touchPresence = async (userId, platform, socketId) => {
    if (!getIsRedisReady()) return;
    const key = presenceKey(userId, platform);
    await redisClient.set(key, socketId, { EX: PRESENCE_TTL_SECONDS });
  };

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = verifyAccessToken(token);
      if (!decoded || !decoded.userId) {
        return next(new Error("Authentication error: Invalid token"));
      }

      const accountStatus = decoded.accountStatus || "active";
      if (accountStatus === "locked" || accountStatus === "deleted") {
        return next(new Error("Authentication error: Account is not active"));
      }

      const decodedSessionId = decoded.sessionId;
      if (!decodedSessionId) {
        return next(new Error("Authentication error: Session expired"));
      }

      const tokenPlatform = normalizePlatform(
        decoded.platform || socket.handshake.auth?.platform,
      );

      const scopedSessionId = await safeGet(sessionKey(decoded.userId, tokenPlatform));
      let isValidSession = Boolean(scopedSessionId && scopedSessionId === decodedSessionId);

      if (!isValidSession) {
        const legacySessionIdValue = await safeGet(legacySessionKey(decoded.userId));
        isValidSession = Boolean(
          legacySessionIdValue && legacySessionIdValue === decodedSessionId,
        );
      }

      if (!isValidSession) {
        return next(new Error("Authentication error: Session expired"));
      }

      socket.userId = String(decoded.userId);
      socket.userEmail = decoded.email;
      socket.platform = tokenPlatform;
      socket.sessionId = String(decodedSessionId);

      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message || "Token verification failed"}`));
    }
  });

  const isUserOnline = async (userId) => {
    try {
      if (!getIsRedisReady()) return false;

      const normalizedUserId = normalizeUserIdValue(userId);
      if (!normalizedUserId) return false;

      for await (const key of redisClient.scanIterator({
        MATCH: String(allPresencePattern(normalizedUserId)),
        COUNT: 10,
      })) {
        const socketId = await redisClient.get(String(key));
        if (socketId && io.sockets.sockets.has(socketId)) {
          return true;
        }

        // Cleanup stale presence keys left behind by abrupt disconnects.
        await redisClient.del(String(key));
      }

      return false;
    } catch (err) {
      console.error("isUserOnline error:", err.message);
      return false;
    }
  };

  const emitToUserRoom = (targetUserId, event, payload) => {
    const roomId = `user:${String(targetUserId)}`;
    const room = io.sockets.adapter.rooms.get(roomId);
    const hasOnlineSocket = Boolean(room && room.size > 0);
    if (hasOnlineSocket) {
      io.to(roomId).emit(event, payload);
    }
    return hasOnlineSocket;
  };

const isMemberOfConversation = (conversation, userId) =>
  Boolean(conversation?.participants?.some((p) => String(p.userId) === String(userId)));

const getOtherParticipantId = (conversation, userId) => {
  if (!conversation || conversation.type !== "private") return null;
  const selfId = String(userId);
  const otherParticipant = (conversation.participants || []).find(
    (participant) => String(participant.userId) !== selfId,
  );
  return otherParticipant ? Number(otherParticipant.userId) : null;
};

  const ensureConversationMembership = async (conversationId, userId) => {
    const conversation = await conversationService.getConversation(conversationId);
    if (!conversation) {
      const err = new Error("Conversation not found");
      err.statusCode = 404;
      throw err;
    }

    if (!isMemberOfConversation(conversation, userId)) {
      const err = new Error("Not a member of this conversation");
      err.statusCode = 403;
      throw err;
    }

    return conversation;
  };

  const joinConversationRoom = async (socket, conversationId) => {
    const conversation = await ensureConversationMembership(conversationId, socket.userId);
    socket.join(toRoomId(conversationId));
    return conversation;
  };

  const autoJoinConversationRooms = async (socket) => {
    const conversations = await conversationService.getConversations(socket.userId);
    const ids = (conversations || []).map((c) => c._id || c.id).filter(Boolean);
    ids.forEach((id) => socket.join(toRoomId(id)));
  };

  const forceLogoutOlderSessions = (socket) => {
    const roomId = `user:${socket.userId}`;
    const roomMembers = io.sockets.adapter.rooms.get(roomId);
    if (!roomMembers || roomMembers.size <= 1) return;

    for (const socketId of roomMembers) {
      if (socketId === socket.id) continue;
      const existingSocket = io.sockets.sockets.get(socketId);
      if (!existingSocket) continue;

      const samePlatform =
        normalizePlatform(existingSocket.platform) === normalizePlatform(socket.platform);
      if (!samePlatform) continue;

      const sameSession = existingSocket.sessionId && existingSocket.sessionId === socket.sessionId;
      if (sameSession) continue;

      existingSocket.emit("session:force_logout", {
        reason: "Co tai khoan da dang nhap tren thiet bi khac cung nen tang.",
        platform: socket.platform,
      });

      setTimeout(() => {
        if (existingSocket.connected) {
          existingSocket.disconnect(true);
        }
      }, 300);
    }
  };

  io.on("connection", async (socket) => {
    const { userId, platform } = socket;
    console.log(`Socket connected: ${socket.id} | User: ${userId} | Platform: ${platform}`);

    let presenceHeartbeat = null;

    socket.join(`user:${userId}`);

    try {
      forceLogoutOlderSessions(socket);

      const wasOnlineBefore = await isUserOnline(userId);

      if (getIsRedisReady()) {
        await touchPresence(userId, platform, socket.id);

        presenceHeartbeat = setInterval(() => {
          if (!socket.connected || !getIsRedisReady()) return;
          touchPresence(userId, platform, socket.id).catch((err) => {
            console.warn("Failed to refresh presence TTL:", err?.message || err);
          });
        }, PRESENCE_HEARTBEAT_MS);
      }

      await userRepository
        .updateUser(String(userId), {
          presenceStatus: "online",
        })
        .catch((err) => console.warn("Failed to update presenceStatus to online:", err?.message));

      if (!wasOnlineBefore) {
        socket.broadcast.emit("presence:online", { userId });
      }

      await autoJoinConversationRooms(socket);
    } catch (err) {
      console.error("Connection setup error:", err.message);
    }

    socket.on("room:join", async (conversationId, callback) => {
      try {
        await joinConversationRoom(socket, conversationId);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("room:leave", (conversationId) => {
      socket.leave(toRoomId(conversationId));
    });

    // Backward compatibility
    socket.on("chat:join", async ({ conversationId }, callback) => {
      try {
        await joinConversationRoom(socket, conversationId);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("chat:leave", ({ conversationId }) => {
      socket.leave(toRoomId(conversationId));
    });

    socket.on("chat:send", async (data, callback) => {
      try {
        const {
          conversationId,
          type = "text",
          content,
          replyTo = null,
          metadata = null,
          clientTempId = null,
        } = data || {};

        if (!conversationId) {
          return callback?.({ success: false, error: "conversationId is required" });
        }

        const conversation = await ensureConversationMembership(conversationId, socket.userId);

        if (conversation.type === "group") {
          GroupService.ensureCanSendMessage(conversation, {
            userId: socket.userId,
            type,
            metadata,
          });
        } else {
          const otherUserId = getOtherParticipantId(conversation, socket.userId);
          if (otherUserId) {
            await friendService.ensureCanMessageBetweenUsers(socket.userId, otherUserId);
          }
        }

        const saved = await messageService.createMessage({
          conversationId,
          senderId: socket.userId,
          type,
          content,
          metadata,
          replyTo,
          reactions: [],
          readBy: [],
          isDeleted: false,
        });

        await conversationModel.updateConversation(conversationId, {
          lastMessage: {
            content: getLastMessageText({ type, content, metadata }),
            type,
            senderId: socket.userId,
            timestamp: saved.createdAt,
          },
        });

        const message = normalizeMessage(saved);
        const roomId = toRoomId(conversationId);

        // Sender receives canonical message in ACK, others via room broadcast.
        socket.to(roomId).emit("chat:message", message);
        io.to(`user:${socket.userId}`).emit("chat:conversation_updated", {
          conversationId,
          lastMessage: {
            content: getLastMessageText({ type, content, metadata }),
            type,
            senderId: socket.userId,
            timestamp: saved.createdAt,
          },
        });

        callback?.({
          success: true,
          message,
          clientTempId,
        });
      } catch (err) {
        console.error("chat:send error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("chat:typing", async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        await ensureConversationMembership(conversationId, socket.userId);
        socket.to(toRoomId(conversationId)).emit("chat:typing", {
          conversationId,
          userId: socket.userId,
        });
      } catch (err) {
        console.warn("chat:typing denied:", err.message);
      }
    });

    socket.on("chat:stop_typing", async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        await ensureConversationMembership(conversationId, socket.userId);
        socket.to(toRoomId(conversationId)).emit("chat:stop_typing", {
          conversationId,
          userId: socket.userId,
        });
      } catch (err) {
        console.warn("chat:stop_typing denied:", err.message);
      }
    });

    socket.on("chat:read", async ({ conversationId, messageId }, callback) => {
      try {
        if (!conversationId || !messageId) {
          return callback?.({ success: false, error: "conversationId and messageId are required" });
        }

        await ensureConversationMembership(conversationId, socket.userId);

        const message = await messageService.getMessage(messageId);
        if (!message) {
          return callback?.({ success: false, error: "Message not found" });
        }
        if (String(message.conversationId) !== String(conversationId)) {
          return callback?.({ success: false, error: "Message does not belong to conversation" });
        }

        const currentReadBy = Array.isArray(message.readBy) ? message.readBy : [];
        const alreadyRead = currentReadBy.some((r) => String(r.userId) === socket.userId);
        const readBy = alreadyRead
          ? currentReadBy
          : [...currentReadBy, { userId: socket.userId, readAt: new Date().toISOString() }];

        if (!alreadyRead) {
          await messageService.updateMessage(messageId, { readBy });
        }

        io.to(toRoomId(conversationId)).emit("chat:read", {
          conversationId,
          messageId,
          userId: socket.userId,
          readBy,
        });

        callback?.({ success: true });
      } catch (err) {
        console.error("chat:read error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("chat:reaction", async (data, callback) => {
      try {
        const { messageId, conversationId, emoji } = data || {};
        if (!messageId || !conversationId || !emoji) {
          return callback?.({ success: false, error: "messageId, conversationId and emoji are required" });
        }

        await ensureConversationMembership(conversationId, socket.userId);

        const message = await messageService.getMessage(messageId);
        if (!message) {
          return callback?.({ success: false, error: "Message not found" });
        }
        if (String(message.conversationId) !== String(conversationId)) {
          return callback?.({ success: false, error: "Message does not belong to conversation" });
        }

        const reactions = Array.isArray(message.reactions) ? [...message.reactions] : [];
        const existingReactionIndex = reactions.findIndex((r) => String(r.userId) === socket.userId);

        if (existingReactionIndex !== -1) {
          if (reactions[existingReactionIndex].emoji === emoji) {
            reactions.splice(existingReactionIndex, 1);
          } else {
            reactions[existingReactionIndex].emoji = emoji;
          }
        } else {
          reactions.push({ userId: socket.userId, emoji });
        }

        await messageService.updateMessage(messageId, { reactions });

        io.to(toRoomId(conversationId)).emit("chat:reaction", {
          messageId,
          conversationId,
          reactions,
        });

        callback?.({ success: true, reactions });
      } catch (err) {
        console.error("chat:reaction error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("chat:recall", async (data, callback) => {
      try {
        const { messageId, conversationId } = data || {};
        if (!messageId || !conversationId) {
          return callback?.({ success: false, error: "messageId and conversationId are required" });
        }

        await ensureConversationMembership(conversationId, socket.userId);

        const message = await messageService.getMessage(messageId);
        if (!message) {
          return callback?.({ success: false, error: "Message not found" });
        }
        if (String(message.conversationId) !== String(conversationId)) {
          return callback?.({ success: false, error: "Message does not belong to conversation" });
        }
        if (String(message.senderId) !== socket.userId) {
          return callback?.({ success: false, error: "No permission to recall this message" });
        }

        await messageService.updateMessage(messageId, { isDeleted: true });

        io.to(toRoomId(conversationId)).emit("chat:recalled", {
          messageId,
          conversationId,
        });

        callback?.({ success: true });
      } catch (err) {
        console.error("chat:recall error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    const persistCallHistory = async (data, fallbackStatus) => {
      try {
        const conversationId = String(data?.conversationId || "");
        if (!conversationId) return;

        await ensureConversationMembership(conversationId, socket.userId);

        const status = resolveCallStatus(data?.status, fallbackStatus);
        const callType = resolveCallType(data?.callType, "audio");
        const duration = resolveCallDuration(data?.duration);

        const saved = await messageService.createMessage({
          conversationId,
          senderId: socket.userId,
          type: "call",
          content: { status, callType, duration },
          metadata: null,
          replyTo: null,
          reactions: [],
          readBy: [],
          isDeleted: false,
        });

        const roomId = toRoomId(conversationId);
        const lastMessageContent = getLastMessageText({
          type: "call",
          content: { status, callType, duration },
          metadata: null,
        });

        await conversationModel.updateConversation(conversationId, {
          lastMessage: {
            content: lastMessageContent,
            type: "call",
            senderId: socket.userId,
            timestamp: saved.createdAt,
          },
        });

        const normalized = normalizeMessage(saved);
        io.to(roomId).emit("chat:message", normalized);
        io.to(`user:${socket.userId}`).emit("chat:conversation_updated", {
          conversationId,
          lastMessage: {
            content: lastMessageContent,
            type: "call",
            senderId: socket.userId,
            timestamp: saved.createdAt,
          },
        });
      } catch (error) {
        console.warn("persistCallHistory error:", error?.message || error);
      }
    };

    socket.on("video:call-user", async (data) => {
      const delivered = emitToUserRoom(data.toUserId, "video:incoming-call", data);
      if (!delivered) {
        socket.emit("video:user-offline", { toUserId: data.toUserId });
      }
    });

    socket.on("video:answer-call", async (data) => {
      emitToUserRoom(data.toUserId, "video:call-answered", data);
    });

    socket.on("video:reject-call", async (data) => {
      emitToUserRoom(data.toUserId, "video:call-rejected", data);
      await persistCallHistory(data, "rejected");
    });

    socket.on("video:end-call", async (data) => {
      emitToUserRoom(data.toUserId, "video:call-ended", data);
      await persistCallHistory(
        data,
        String(data?.status || "").toLowerCase() === "cancelled"
          ? "cancelled"
          : "finished",
      );
    });

    socket.on("video:signal", async (data) => {
      // Relay WebRTC SDP / ICE between caller and callee
      emitToUserRoom(data.toUserId, "video:signal", {
        fromUserId: socket.userId,
        conversationId: data.conversationId,
        signal: data.signal,
      });
    });

    socket.on("video:frame", async (data) => {
      // Relay video frame (base64 JPEG) from sender to receiver
      if (data.toUserId) {
        emitToUserRoom(data.toUserId, "video:frame", {
          fromUserId: socket.userId,
          conversationId: data.conversationId,
          frame: data.frame,
        });
      }
    });

    socket.on("video:audio-frame", async (data) => {
      // Relay audio chunk (base64) from sender to receiver
      if (data.toUserId) {
        emitToUserRoom(data.toUserId, "video:audio-frame", {
          fromUserId: socket.userId,
          conversationId: data.conversationId,
          audio: data.audio,
          audioMimeType: data.audioMimeType,
        });
      }
    });

    socket.on("presence:get_online_users", async (userIds, callback) => {
      try {
        const onlineStatuses = {};
        const targetIds = Array.isArray(userIds)
          ? userIds
          : userIds && typeof userIds === "object"
            ? Object.values(userIds)
            : [];

        for (const uid of targetIds) {
          const normalizedUid = normalizeUserIdValue(uid);
          if (!normalizedUid) continue;
          onlineStatuses[normalizedUid] = await isUserOnline(normalizedUid);
        }

        callback?.({ success: true, onlineStatuses });
      } catch (err) {
        console.error("presence:get_online_users error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("disconnect", async () => {
      try {
        if (presenceHeartbeat) {
          clearInterval(presenceHeartbeat);
          presenceHeartbeat = null;
        }

        if (getIsRedisReady()) {
          const key = presenceKey(socket.userId, socket.platform);
          const storedSocketId = await redisClient.get(key);
          if (storedSocketId === socket.id) {
            await redisClient.del(key);
          }
        }

        const stillOnline = await isUserOnline(socket.userId);
        if (!stillOnline) {
          await userRepository
            .updateUser(String(socket.userId), {
              presenceStatus: "offline",
              lastActiveAt: new Date().toISOString(),
            })
            .catch((err) => console.warn("Failed to update presenceStatus to offline:", err?.message));

          socket.broadcast.emit("presence:offline", { userId: socket.userId });
        }
      } catch (err) {
        console.error("disconnect presence cleanup error:", err);
      }
    });
  });

  return io;
};
