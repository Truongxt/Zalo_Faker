const { Server } = require("socket.io");
const messageService = require("../services/messageService");
const conversationService = require("../services/conversationService");
const conversationModel = require("../models/conversation");
const GroupService = require("../services/groupService");
const PollService = require("../services/pollService");
const friendService = require("../services/friendService");
const userRepository = require("../repository/userRepository");
const { verifyAccessToken } = require("../utils/jwt");
const { redisClient, getIsRedisReady, safeGet } = require("../utils/redisClient");
const groupCallManager = require("../services/groupCallManager");
const fileService = require("../services/file.service");

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

const MEDIA_FALLBACK_BY_TYPE = {
  image: "[Hinh anh]",
  video: "[Video]",
  voice: "[Tin nhan thoai]",
  sticker: "[Nhan dan]",
  file: "[File]",
  call: "[Cuoc goi]",
};

const toRoomId = (conversationId) => `conv:${String(conversationId)}`;

const normalizeMessage = (message) => {
  const messageObj = typeof message?.toObject === "function" ? message.toObject() : message;
  return {
    ...messageObj,
    id: messageObj?._id || messageObj?.id,
    reactions: Array.isArray(messageObj?.reactions) ? messageObj.reactions : [],
    readBy: Array.isArray(messageObj?.readBy) ? messageObj.readBy : [],
    isDeleted: Boolean(messageObj?.isDeleted),
  };
};

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
  if (callPayload.status === "finished") return `Cuộc gọi${suffix}`;
  if (callPayload.status === "missed") return `Cuộc gọi nhỡ${suffix}`;
  if (callPayload.status === "rejected") return "Cuộc gọi đã từ chối";
  if (callPayload.status === "cancelled") return "Cuộc gọi đã hủy";
  return callPayload.callType === "video" ? "Cuộc gọi video" : "Cuộc gọi";
};

const resolveUserDisplayName = (user, fallback = "Nguoi dung") => {
  if (!user || typeof user !== "object") return fallback;
  return (
    String(user.fullName || "").trim()
    || String(user.userName || "").trim()
    || String(user.name || "").trim()
    || fallback
  );
};

const resolveUserAvatar = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.avatarUrl || user.avartarUrl || null;
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

const getLastMessageText = ({ type, content, metadata, attachments }) => {
  if (type === PollService.POLL_MESSAGE_TYPE) {
    return PollService.getPollPreviewText(content);
  }

  const callPayload = parseCallPayload(content);
  const contentText =
    typeof content === "string"
      ? content
      : typeof content?.text === "string"
        ? content.text
        : "";

  if (metadata?.isAnnouncement) {
    return `[Thông báo] ${contentText}`.trim();
  }

  if (type === "call" || callPayload) {
    return getCallPreviewText(callPayload || { callType: "audio", status: "finished" });
  }

  if (contentText) return contentText;
  if (type === "image" && Array.isArray(attachments) && attachments.length >= 2) {
    return `[${attachments.length} hình ảnh]${contentText ? ` ${contentText}` : ""}`;
  }
  return MEDIA_FALLBACK_BY_TYPE[type] || "[Tin nhắn]";
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

  const isUserOnline = async (userId, excludeSocketId = null) => {
    try {
      const room = io.sockets.adapter.rooms.get(`user:${String(userId)}`);
      if (room) {
        for (const socketId of room) {
          if (socketId !== excludeSocketId && io.sockets.sockets.has(socketId)) {
            return true;
          }
        }
      }

      if (!getIsRedisReady()) return false;

      for await (const key of redisClient.scanIterator({
        MATCH: allPresencePattern(userId),
        COUNT: 10,
      })) {
        const socketId = await redisClient.get(key);
        if (socketId && socketId !== excludeSocketId && io.sockets.sockets.has(socketId)) {
          return true;
        }

        // Cleanup stale presence keys left behind by abrupt disconnects.
        await redisClient.del(key);
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

      const wasOnlineBefore = await isUserOnline(userId, socket.id);

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
          attachments = null,
          replyTo = null,
          metadata = null,
          clientTempId = null,
        } = data || {};

        if (!conversationId) {
          return callback?.({ success: false, error: "conversationId is required" });
        }

        const conversation = await ensureConversationMembership(conversationId, socket.userId);

        let normalizedContent = content;
        if (type === PollService.POLL_MESSAGE_TYPE) {
          if (conversation.type !== "group") {
            return callback?.({
              success: false,
              error: "Polls are only supported in group conversations",
            });
          }
          normalizedContent = PollService.normalizePollMessageContent(
            content,
            socket.userId,
          );
        }

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
          content: normalizedContent,
          attachments,
          metadata,
          replyTo,
          reactions: [],
          readBy: [],
          isDeleted: false,
        });

        await conversationModel.updateConversation(conversationId, {
          lastMessage: {
            content: getLastMessageText({ type, content: normalizedContent, metadata, attachments }),
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
            content: getLastMessageText({
              type,
              content: normalizedContent,
              metadata,
              attachments,
            }),
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

        const user = await userRepository.getById(socket.userId);
        const userName = user?.fullName || user?.userName || "Người dùng";

        if (existingReactionIndex !== -1) {
          if (reactions[existingReactionIndex].emoji === emoji) {
            reactions.splice(existingReactionIndex, 1);
          } else {
            reactions[existingReactionIndex].emoji = emoji;
            reactions[existingReactionIndex].userName = userName;
          }
        } else {
          reactions.push({ 
            userId: socket.userId, 
            emoji,
            userName
          });
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

        // Xóa folder nếu có trong metadata
        if (message.metadata && message.metadata.folderId) {
          const { folder, subfolder } = message.metadata;
          const folderPath = `${folder}/${subfolder}`;
          fileService.deleteFolder(folderPath).catch(err => console.error("Failed to delete folder on recall:", err));
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

    socket.on("chat:sync_pinned_message", async (data, callback) => {
      try {
        const conversationId = String(data?.conversationId || "");
        if (!conversationId) {
          return callback?.({ success: false, error: "conversationId is required" });
        }

        await ensureConversationMembership(conversationId, socket.userId);
        const conversation = await conversationService.getConversation(conversationId);

        io.to(toRoomId(conversationId)).emit("chat:pinned_message", {
          conversationId,
          pinnedMessage: conversation?.groupSettings?.pinnedMessage || null,
          updatedBy: socket.userId,
        });

        callback?.({ success: true });
      } catch (err) {
        console.error("chat:sync_pinned_message error:", err);
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
      if (data?.isGroupCall && data?.conversationId) {
        try {
          const conversation = await ensureConversationMembership(
            data.conversationId,
            socket.userId,
          );
          if (conversation?.type === "group") {
            GroupService.ensureCanStartCall(conversation, {
              userId: socket.userId,
            });
          }
        } catch (error) {
          socket.emit("video:call-error", {
            conversationId: data?.conversationId,
            error: error?.message || "Cannot start group call",
          });
          return;
        }
      }

      if (data.isGroupCall) {
        // For group calls, signaling is handled via group:create and group:join.
        // We don't want to emit video:incoming-call (1-1) for group calls.
      } else {
        const delivered = emitToUserRoom(data.toUserId, "video:incoming-call", data);
        if (!delivered) {
          socket.emit("video:user-offline", { toUserId: data.toUserId });
        }
      }
    });

    socket.on("video:answer-call", async (data) => {
      if (data.isGroupCall) {
        socket.to(toRoomId(data.conversationId)).emit("video:call-answered", data);
      } else {
        emitToUserRoom(data.toUserId, "video:call-answered", data);
      }
    });

    socket.on("video:reject-call", async (data) => {
      if (data.isGroupCall) {
        socket.to(toRoomId(data.conversationId)).emit("video:call-rejected", data);
      } else {
        emitToUserRoom(data.toUserId, "video:call-rejected", data);
      }
      await persistCallHistory(data, "rejected");
    });

    socket.on("video:end-call", async (data) => {
      if (data.isGroupCall) {
        socket.to(toRoomId(data.conversationId)).emit("video:call-ended", data);
      } else {
        emitToUserRoom(data.toUserId, "video:call-ended", data);
      }
      await persistCallHistory(
        data,
        String(data?.status || "").toLowerCase() === "cancelled"
          ? "cancelled"
          : "finished",
      );
    });

    socket.on("video:leave-call", async (data) => {
      socket.to(toRoomId(data.conversationId)).emit("video:user-left", data);
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
      const senderUserId = socket.userId || data?.fromUserId;
      if (data.isGroupCall) {
        socket.to(toRoomId(data.conversationId)).emit("video:frame", {
          ...data,
          fromUserId: senderUserId,
        });
      } else if (data.toUserId) {
        emitToUserRoom(data.toUserId, "video:frame", {
          fromUserId: senderUserId,
          conversationId: data.conversationId,
          frame: data.frame,
        });
      }
    });

    socket.on("video:audio-frame", async (data) => {
      // Relay audio chunk (base64) from sender to receiver
      const senderUserId = socket.userId || data?.fromUserId;
      if (data.isGroupCall) {
        socket.to(toRoomId(data.conversationId)).emit("video:audio-frame", {
          ...data,
          fromUserId: senderUserId,
        });
      } else if (data.toUserId) {
        emitToUserRoom(data.toUserId, "video:audio-frame", {
          fromUserId: senderUserId,
          conversationId: data.conversationId,
          audio: data.audio,
          audioMimeType: data.audioMimeType,
        });
      }
    });

    // ═══════════════════════════════════════════════════════
    // GROUP CALL — Room Management + WebRTC Signaling
    // ═══════════════════════════════════════════════════════

    socket.on("group:create", async (data, callback) => {
      try {
        const { conversationId, callType, maxParticipants, autoInvite } = data || {};
        if (!conversationId) {
          return callback?.({ success: false, error: "conversationId is required" });
        }

        const conversation = await ensureConversationMembership(
          conversationId,
          socket.userId,
        );
        GroupService.ensureCanStartCall(conversation, {
          userId: socket.userId,
        });

        const room = groupCallManager.createRoom(
          conversationId,
          socket.userId,
          socket.id,
          callType,
          maxParticipants,
        );

        console.log(`[GroupCall] Room created: ${room.roomId} by user ${socket.userId}`);
        callback?.({
          success: true,
          room: groupCallManager.serializeRoom(room),
        });

        // Auto-invite all conversation members if requested
        if (autoInvite) {
          try {
            const conversation = await conversationModel.getOneConversation(conversationId);
            if (conversation && Array.isArray(conversation.participants)) {
              let callerInfo = null;
              try {
                callerInfo = await userRepository.getById(socket.userId);
              } catch (e) { }

              const invitePayload = {
                roomId: room.roomId,
                conversationId: room.conversationId,
                callType: room.callType,
                hostUserId: room.hostUserId,
                callerName: resolveUserDisplayName(callerInfo, "Nguoi dung"),
                callerAvatar: resolveUserAvatar(callerInfo),
                participantCount: room.participants.size,
                isGroupCall: true,
              };

              let invitedCount = 0;
              for (const p of conversation.participants) {
                const uid = String(p.userId || p);
                if (uid === socket.userId) continue;
                if (room.participants.has(uid)) continue;
                const delivered = emitToUserRoom(uid, "group:incoming", invitePayload);
                if (delivered) invitedCount++;
              }
              console.log(`[GroupCall] Auto-invited ${invitedCount} users to room ${room.roomId}`);
            }
          } catch (e) {
            console.warn("[GroupCall] Auto-invite failed:", e?.message);
          }
        }
      } catch (err) {
        console.error("group:create error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("group:invite", async (data, callback) => {
      try {
        const { roomId, userIds } = data || {};
        if (!roomId || !Array.isArray(userIds) || userIds.length === 0) {
          return callback?.({ success: false, error: "roomId and userIds[] are required" });
        }

        const room = groupCallManager.getRoom(roomId);
        if (!room) {
          return callback?.({ success: false, error: "Room not found" });
        }

        // Get user info for the caller
        let callerInfo = null;
        try {
          callerInfo = await userRepository.getById(socket.userId);
        } catch (e) {
          // fallback
        }

        const invitePayload = {
          roomId: room.roomId,
          conversationId: room.conversationId,
          callType: room.callType,
          hostUserId: room.hostUserId,
          callerName: resolveUserDisplayName(callerInfo, "Nguoi dung"),
          callerAvatar: resolveUserAvatar(callerInfo),
          participantCount: room.participants.size,
          isGroupCall: true,
        };

        let invitedCount = 0;
        for (const targetUserId of userIds) {
          const uid = String(targetUserId);
          if (room.participants.has(uid)) continue; // Already in room
          const delivered = emitToUserRoom(uid, "group:incoming", invitePayload);
          if (delivered) invitedCount++;
        }

        console.log(`[GroupCall] Invited ${invitedCount}/${userIds.length} users to room ${roomId}`);
        callback?.({ success: true, invitedCount });
      } catch (err) {
        console.error("group:invite error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("group:join", async (data, callback) => {
      try {
        const { roomId } = data || {};
        if (!roomId) {
          return callback?.({ success: false, error: "roomId is required" });
        }

        const room = groupCallManager.getRoom(roomId);
        if (!room) {
          return callback?.({ success: false, error: "Room not found" });
        }

        // Ensure user is member of the conversation
        await ensureConversationMembership(room.conversationId, socket.userId);

        // Get current participants BEFORE joining (for signaling)
        const existingParticipantsRaw = groupCallManager.getParticipantsArray(roomId)
          .filter((p) => p.userId !== socket.userId);

        const existingParticipants = await Promise.all(
          existingParticipantsRaw.map(async (participant) => {
            let participantInfo = null;
            try {
              participantInfo = await userRepository.getById(participant.userId);
            } catch (e) {
              participantInfo = null;
            }

            return {
              ...participant,
              name: resolveUserDisplayName(participantInfo, String(participant.userId)),
              avatar: resolveUserAvatar(participantInfo),
            };
          }),
        );

        const { isNew, socketChanged } = groupCallManager.joinRoom(
          roomId,
          socket.userId,
          socket.id,
        );

        // Get user info
        let userInfo = null;
        try {
          userInfo = await userRepository.getById(socket.userId);
        } catch (e) {
          // fallback
        }

        // Send current participants list to the joining user
        callback?.({
          success: true,
          room: groupCallManager.serializeRoom(room),
          existingParticipants,
        });

        if (isNew || socketChanged) {
          // Notify all other participants that a new user joined
          const joinPayload = {
            roomId,
            userId: socket.userId,
            userName: resolveUserDisplayName(userInfo, "Nguoi dung"),
            userAvatar: resolveUserAvatar(userInfo),
            participantCount: room.participants.size,
            reconnected: Boolean(socketChanged),
          };

          for (const participant of existingParticipants) {
            emitToUserRoom(participant.userId, "group:user-joined", joinPayload);
          }

          console.log(
            `[GroupCall] User ${socket.userId} joined room ${roomId} (${room.participants.size} total)`,
          );
        }
      } catch (err) {
        console.error("group:join error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("group:leave", async (data, callback) => {
      try {
        const { roomId } = data || {};
        if (!roomId) {
          return callback?.({ success: false, error: "roomId is required" });
        }

        const room = groupCallManager.getRoom(roomId);
        if (!room) {
          return callback?.({ success: true }); // Already gone
        }

        const conversationId = room.conversationId;
        const remaining = groupCallManager.leaveRoom(roomId, socket.userId);

        // Notify remaining participants
        if (remaining && remaining.length > 0) {
          const leavePayload = {
            roomId,
            userId: socket.userId,
            participantCount: remaining.length,
            newHostUserId: groupCallManager.getRoom(roomId)?.hostUserId || null,
          };

          for (const participant of remaining) {
            emitToUserRoom(participant.userId, "group:user-left", leavePayload);
          }
        } else {
          // Room was destroyed — broadcast to conversation room so clients remove the banner
          io.to(toRoomId(conversationId)).emit("group:room-ended", {
            conversationId,
            roomId,
          });
        }

        // Also emit on conversation room for legacy compatibility (mobile)
        socket.to(toRoomId(conversationId)).emit("video:user-left", {
          fromUserId: socket.userId,
          conversationId,
          isGroupCall: true,
        });

        console.log(`[GroupCall] User ${socket.userId} left room ${roomId}`);
        callback?.({ success: true });
      } catch (err) {
        console.error("group:leave error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("group:kick", async (data, callback) => {
      try {
        const { roomId, targetUserId } = data || {};
        if (!roomId || !targetUserId) {
          return callback?.({ success: false, error: "roomId and targetUserId are required" });
        }

        const { targetSocketId, remaining } = groupCallManager.kickUser(
          roomId,
          socket.userId,
          targetUserId,
        );

        // Notify kicked user
        emitToUserRoom(targetUserId, "group:user-kicked", {
          roomId,
          kickedBy: socket.userId,
        });

        // Notify remaining participants
        if (remaining) {
          for (const participant of remaining) {
            emitToUserRoom(participant.userId, "group:user-left", {
              roomId,
              userId: targetUserId,
              kicked: true,
              participantCount: remaining.length,
            });
          }
        }

        console.log(`[GroupCall] User ${targetUserId} kicked from room ${roomId} by ${socket.userId}`);
        callback?.({ success: true });
      } catch (err) {
        console.error("group:kick error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("group:media-toggle", async (data) => {
      try {
        const { roomId, isMuted, isVideoOff } = data || {};
        if (!roomId) return;

        groupCallManager.updateParticipantMedia(roomId, socket.userId, {
          isMuted,
          isVideoOff,
        });

        const room = groupCallManager.getRoom(roomId);
        if (!room) return;

        // Broadcast to all other participants
        for (const [uid, participant] of room.participants) {
          if (uid === socket.userId) continue;
          emitToUserRoom(uid, "group:media-changed", {
            roomId,
            userId: socket.userId,
            isMuted,
            isVideoOff,
          });
        }
      } catch (err) {
        console.warn("group:media-toggle error:", err?.message);
      }
    });

    // WebRTC Signaling for MESH — relay offer/answer/ICE to target user
    socket.on("webrtc:offer", (data) => {
      const { toUserId, offer, roomId } = data || {};
      if (!toUserId || !offer) return;
      emitToUserRoom(toUserId, "webrtc:offer", {
        fromUserId: socket.userId,
        offer,
        roomId,
      });
    });

    socket.on("webrtc:answer", (data) => {
      const { toUserId, answer, roomId } = data || {};
      if (!toUserId || !answer) return;
      emitToUserRoom(toUserId, "webrtc:answer", {
        fromUserId: socket.userId,
        answer,
        roomId,
      });
    });

    socket.on("webrtc:ice-candidate", (data) => {
      const { toUserId, candidate, roomId } = data || {};
      if (!toUserId || !candidate) return;
      emitToUserRoom(toUserId, "webrtc:ice-candidate", {
        fromUserId: socket.userId,
        candidate,
        roomId,
      });
    });

    // Check if there is an active group call for a conversation
    socket.on("group:check-active", async (data, callback) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) {
          return callback?.({ success: false, error: "conversationId is required" });
        }

        const room = groupCallManager.getRoomByConversation(conversationId);
        callback?.({
          success: true,
          room: room ? groupCallManager.serializeRoom(room) : null,
        });
      } catch (err) {
        console.error("group:check-active error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    // ═══════════════════════════════════════════════════════
    // END GROUP CALL
    // ═══════════════════════════════════════════════════════

    socket.on("presence:get_online_users", async (userIds, callback) => {
      try {
        const onlineStatuses = {};
        const lastSeenStatuses = {};
        for (const uid of userIds || []) {
          const normalizedUid = String(uid);
          const online = await isUserOnline(normalizedUid);
          onlineStatuses[uid] = online;

          if (!online) {
            const user = await userRepository.getById(normalizedUid).catch(() => null);
            lastSeenStatuses[uid] = user?.lastActiveAt || null;
          }
        }

        callback?.({ success: true, onlineStatuses, lastSeenStatuses });
      } catch (err) {
        console.error("presence:get_online_users error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("disconnect", async () => {
      try {
        // Group call cleanup — remove user from any active call room
        const callCleanup = groupCallManager.cleanupBySocketId(socket.id);
        if (callCleanup) {
          const { roomId, userId: leftUserId, remaining, conversationId } = callCleanup;
          if (remaining && remaining.length > 0) {
            const leavePayload = {
              roomId,
              userId: leftUserId,
              participantCount: remaining.length,
              newHostUserId: groupCallManager.getRoom(roomId)?.hostUserId || null,
              disconnected: true,
            };
            for (const participant of remaining) {
              emitToUserRoom(participant.userId, "group:user-left", leavePayload);
            }
          } else if (conversationId) {
            // Room was destroyed — broadcast to conversation room
            io.to(toRoomId(conversationId)).emit("group:room-ended", {
              conversationId,
              roomId,
            });
          }
          // Legacy compatibility for mobile
          if (conversationId) {
            socket.to(toRoomId(conversationId)).emit("video:user-left", {
              fromUserId: leftUserId,
              conversationId,
              isGroupCall: true,
              disconnected: true,
            });
          }
          console.log(`[GroupCall] User ${leftUserId} disconnected, removed from room ${roomId}`);
        }

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

        const stillOnline = await isUserOnline(socket.userId, socket.id);
        if (!stillOnline) {
          const lastActiveAt = new Date().toISOString();
          await userRepository
            .updateUser(String(socket.userId), {
              presenceStatus: "offline",
              lastActiveAt,
            })
            .catch((err) => console.warn("Failed to update presenceStatus to offline:", err?.message));

          socket.broadcast.emit("presence:offline", { userId: socket.userId, lastActiveAt });
        }
      } catch (err) {
        console.error("disconnect presence cleanup error:", err);
      }
    });
  });

  return io;
};
