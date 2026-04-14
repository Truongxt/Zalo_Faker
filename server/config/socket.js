const { Server } = require("socket.io");
const messageService = require("../services/messageService");
const conversationService = require("../services/conversationService");
const conversationModel = require("../models/conversation");
const GroupService = require("../services/groupService");
const userRepository = require("../repository/userRepository");
const { verifyAccessToken } = require("../utils/jwt");
const { redisClient, getIsRedisReady, safeGet } = require("../utils/redisClient");

const presenceKey = (userId, platform) => `presence:${userId}:${platform}`;
const allPresencePattern = (userId) => `presence:${userId}:*`;
const sessionKey = (userId, platform = "unknown") => `auth:session:${String(userId)}:${String(platform).toLowerCase()}`;

const MEDIA_FALLBACK_BY_TYPE = {
  image: "[Hinh anh]",
  video: "[Video]",
  voice: "[Tin nhan thoai]",
  sticker: "[Nhan dan]",
  file: "[File]",
  call: "[Cuộc gọi]",
};

const toRoomId = (conversationId) => `conv:${String(conversationId)}`;

const normalizeMessage = (message) => ({
  ...message,
  id: message?._id || message?.id,
  reactions: Array.isArray(message?.reactions) ? message.reactions : [],
  readBy: Array.isArray(message?.readBy) ? message.readBy : [],
  isDeleted: Boolean(message?.isDeleted),
});

const getLastMessageText = ({ type, content, metadata }) => {
  const contentText =
    typeof content === "string"
      ? content
      : typeof content?.text === "string"
      ? content.text
      : "";

  const baseText = contentText || MEDIA_FALLBACK_BY_TYPE[type] || "[Tin nhan]";
  const prefixes = [];

  if (metadata?.isImportant) prefixes.push("[Quan trong]");
  if (metadata?.isAnnouncement) prefixes.push("[Thong bao]");

  if (type === "call") {
    try {
      const data = typeof content === "string" ? JSON.parse(content) : content;
      if (data.status === "missed") return "[Cuộc gọi nhỡ]";
      if (data.status === "rejected") return "[Cuộc gọi bị từ chối]";
      if (data.status === "cancelled") return "[Cuộc gọi đã hủy]";
      return data.callType === "video" ? "[Cuộc gọi video]" : "[Cuộc gọi thoại]";
    } catch (e) {
      return "[Cuộc gọi]";
    }
  }

  return [...prefixes, baseText].join(" ").trim();
};

module.exports = (socketConfig) => {
  const io = new Server(socketConfig, {
    cors: { origin: "*" },
  });

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
      const platform = decoded.platform || "unknown";
      if (!decodedSessionId) {
        return next(new Error("Authentication error: Session expired"));
      }

      const activeSessionId = await safeGet(sessionKey(decoded.userId, platform));
      if (!activeSessionId || activeSessionId !== decodedSessionId) {
        return next(new Error("Authentication error: Session expired"));
      }

      socket.userId = String(decoded.userId);
      socket.userEmail = decoded.email;
      socket.platform = platform;
      socket.sessionId = String(decodedSessionId);

      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message || "Token verification failed"}`));
    }
  });

  const isUserOnline = async (userId) => {
    try {
      if (!getIsRedisReady()) return false;

      for await (const _key of redisClient.scanIterator({
        MATCH: allPresencePattern(userId),
        COUNT: 10,
      })) {
        return true;
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
    const membersCount = room ? room.size : 0;
    
    // Log for debugging frame delivery
    if (event === "video:frame" || event === "video:call-answered") {
      console.log(`[SERVER] Emitting ${event} to ${roomId}. Members in room: ${membersCount}`);
    }

    const hasOnlineSocket = Boolean(membersCount > 0);
    if (hasOnlineSocket) {
      io.to(roomId).emit(event, payload);
    }
    return hasOnlineSocket;
  };

  const isMemberOfConversation = (conversation, userId) =>
    Boolean(conversation?.participants?.some((p) => String(p.userId) === String(userId)));

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

      const samePlatform = existingSocket.platform === socket.platform;
      if (!samePlatform) continue;

      // If on the same platform but same session (e.g. multiple tabs), do not disconnect
      const sameSession = existingSocket.sessionId && existingSocket.sessionId === socket.sessionId;
      if (sameSession) continue;

      existingSocket.emit("session:force_logout", {
        reason: "Co tai khoan da dang nhap tren thiet bi khac.",
        platform: socket.platform,
      });

      setTimeout(() => {
        if (existingSocket.connected) {
          existingSocket.disconnect(true);
        }
      }, 300);
    }
  };

  const callSessions = new Map(); // Store metadata about active calls for history

  io.on("connection", async (socket) => {
    const { userId, platform } = socket;
    console.log(`Socket connected: ${socket.id} | User: ${userId} | Platform: ${platform}`);

    socket.join(`user:${userId}`);

    try {
      forceLogoutOlderSessions(socket);

      const wasOnlineBefore = await isUserOnline(userId);

      if (getIsRedisReady()) {
        const key = presenceKey(userId, platform);
        await redisClient.set(key, socket.id);
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

    socket.on("video:call-user", async (data) => {
      const delivered = emitToUserRoom(data.toUserId, "video:incoming-call", data);
      
      // Track this call in memory
      callSessions.set(data.conversationId, {
        callerId: socket.userId,
        calleeId: data.toUserId,
        startTime: null, // Zero until answered
        callType: data.callType || 'video',
        status: 'calling'
      });

      if (!delivered) {
        socket.emit("video:user-offline", { toUserId: data.toUserId });
        // Optional: Save missed call log immediately if user offline?
      }
    });

    socket.on("video:answer-call", async (data) => {
      const session = callSessions.get(data.conversationId);
      if (session) {
        session.startTime = Date.now();
        session.status = 'accepted';
      }
      emitToUserRoom(data.toUserId, "video:call-answered", data);
    });

    socket.on("video:reject-call", async (data) => {
      const session = callSessions.get(data.conversationId);
      if (session) {
        const conversationId = data.conversationId;
        const callerId = session.callerId;
        
        // Save "Rejected" log
        const callLog = {
          conversationId,
          senderId: session.calleeId, 
          type: 'call',
          content: JSON.stringify({
            status: 'rejected',
            callType: session.callType,
            duration: 0
          })
        };
        
        try {
          const savedMsg = await messageService.createMessage(callLog);
          const normalized = normalizeMessage(savedMsg);
          const roomId = toRoomId(conversationId);
          
          // Broadcast to room so active chat window updates
          io.to(roomId).emit("chat:message", normalized);
          
          // Update last message in DB
          const lastMsgText = getLastMessageText({ type: 'call', content: callLog.content });
          await conversationModel.updateConversation(conversationId, {
            lastMessage: {
              content: lastMsgText,
              type: 'call',
              senderId: session.calleeId,
              timestamp: savedMsg.createdAt,
            },
          });

          // Notify all participants about the conversation update for the sidebar
          const conversation = await conversationModel.getOneConversation(conversationId);
          if (conversation && conversation.participants) {
            conversation.participants.forEach(p => {
              emitToUserRoom(p.userId, "chat:conversation_updated", {
                conversationId,
                lastMessage: {
                  content: lastMsgText,
                  type: 'call',
                  senderId: session.calleeId,
                  timestamp: savedMsg.createdAt,
                },
              });
            });
          }
        } catch (e) {
          console.error("Failed to save reject call log:", e);
        }
        
        callSessions.delete(conversationId);
      }
      emitToUserRoom(data.toUserId, "video:call-rejected", data);
    });

    socket.on("video:end-call", async (data) => {
      const session = callSessions.get(data.conversationId);
      if (session) {
        const conversationId = data.conversationId;
        const isAnswered = session.startTime !== null;
        let duration = 0;
        let status = 'missed';

        if (isAnswered) {
          duration = Math.floor((Date.now() - session.startTime) / 1000);
          status = 'finished';
        } else {
          // If caller ends before answer, it's missed (from caller's POV) or cancelled
          status = socket.userId === session.callerId ? 'cancelled' : 'missed';
        }

        // Save Call Log
        const callLog = {
          conversationId,
          senderId: session.callerId,
          type: 'call',
          content: JSON.stringify({
            status,
            callType: session.callType,
            duration: duration // seconds
          })
        };

        try {
          const savedMsg = await messageService.createMessage(callLog);
          const normalized = normalizeMessage(savedMsg);
          const roomId = toRoomId(conversationId);

          // Broadcast to room so active chat window updates
          io.to(roomId).emit("chat:message", normalized);

          // Update last message in DB
          const lastMsgText = getLastMessageText({ type: 'call', content: callLog.content });
          await conversationModel.updateConversation(conversationId, {
            lastMessage: {
              content: lastMsgText,
              type: 'call',
              senderId: session.callerId,
              timestamp: savedMsg.createdAt,
            },
          });

          // Notify all participants about the conversation update for sidebar
          const conversation = await conversationModel.getOneConversation(conversationId);
          if (conversation && conversation.participants) {
            conversation.participants.forEach(p => {
              emitToUserRoom(p.userId, "chat:conversation_updated", {
                conversationId,
                lastMessage: {
                  content: lastMsgText,
                  type: 'call',
                  senderId: session.callerId,
                  timestamp: savedMsg.createdAt,
                },
              });
            });
          }
        } catch (e) {
          console.error("Failed to save end call log:", e);
        }

        callSessions.delete(conversationId);
      }
      emitToUserRoom(data.toUserId, "video:call-ended", data);
    });

    socket.on("video:signal", async (data) => {
      // Relay WebRTC SDP / ICE between caller and callee
      emitToUserRoom(data.toUserId, "video:signal", {
        fromUserId: socket.userId,
        conversationId: data.conversationId,
        signal: data.signal,
      });
    });

    socket.on("video:audio-frame", async (data) => {
      // Relay Audio chunk (base64)
      emitToUserRoom(data.toUserId, "video:audio-frame", {
        fromUserId: socket.userId,
        conversationId: data.conversationId,
        audio: data.audio, // base64 string
        audioMimeType: data.audioMimeType,
      });
    });

    socket.on("video:frame", async (data) => {
      console.log(`[VIDEO FRAME] SERVER RECEIVED from ${data.fromUserId} to ${data.toUserId}`);
      // Relay Fake Video frame (base64)
      emitToUserRoom(data.toUserId, "video:frame", {
        fromUserId: socket.userId,
        conversationId: data.conversationId,
        frame: data.frame,
      });
    });

    socket.on("presence:get_online_users", async (userIds, callback) => {
      try {
        const onlineStatuses = {};
        for (const uid of userIds || []) {
          onlineStatuses[uid] = await isUserOnline(String(uid));
        }

        callback?.({ success: true, onlineStatuses });
      } catch (err) {
        console.error("presence:get_online_users error:", err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("disconnect", async () => {
      try {
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
