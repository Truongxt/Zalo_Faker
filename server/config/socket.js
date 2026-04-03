const { Server } = require("socket.io");
const messageService = require("../services/messageService");
const conversationModel = require("../models/conversation");

module.exports = (socketConfig) => {
  const io = new Server(socketConfig, {
    cors: { origin: "*" }
  });

  // Lưu userId → socketId để biết ai đang online
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // ── 1. User online ──────────────────────────────────────
    socket.on("user:join", (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;

      // Thông báo cho tất cả biết user này online
      socket.broadcast.emit("presence:online", { userId });
      console.log(`User ${userId} is online`);
    });

    // ── 2. Vào phòng chat ───────────────────────────────────
    socket.on("room:join", (conversationId) => {
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined room ${conversationId}`);
    });

    // Rời phòng chat
    socket.on("room:leave", (conversationId) => {
      socket.leave(conversationId);
    });

    // ── 3. Gửi tin nhắn ────────────────────────────────────
    socket.on("chat:send", async (data, callback) => {
      try {
        const { conversationId, type, content, replyTo } = data;
        const actualSenderId = socket.userId || data.senderId; // Dự phòng data.senderId nếu socket chưa store auth kịp

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

        // Lưu vào DynamoDB
        const saved = await messageService.createMessage({
          conversationId,
          senderId: actualSenderId,
          type: type || "text",
          content,
          replyTo: replyTo || null,
          reactions: [],
          readBy: [],
          isDeleted: false,
        });

        // Cập nhật lastMessage của conversation
        await conversationModel.updateConversation(conversationId, {
          lastMessage: {
            content: content.text || (type === 'image' ? '[Hình ảnh]' : type === 'video' ? '[Video]' : type === 'voice' ? '[Tin nhắn thoại]' : '[File]'),
            type: type || "text",
            senderId: actualSenderId,
            timestamp: saved.createdAt,
          },
        });

        const message = { ...saved, id: saved._id };

        // Broadcast cho tất cả người trong phòng (kể cả người gửi)
        io.to(conversationId).emit("chat:message", message);

        // Trả về cho người gửi biết đã lưu thành công
        if (callback) callback({ success: true, message });

      } catch (err) {
        console.error("chat:send error:", err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ── 4. Typing indicator ─────────────────────────────────
    socket.on("chat:typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("chat:typing", { conversationId, userId });
    });

    socket.on("chat:stop_typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("chat:stop_typing", { conversationId, userId });
    });

    // ── 5. Đã đọc tin nhắn ──────────────────────────────────
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

    // ── 6. Disconnect ────────────────────────────────────────
    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        socket.broadcast.emit("presence:offline", { userId: socket.userId });
        console.log(`User ${socket.userId} is offline`);
      }
    });
    // ── Reaction tin nhắn ────────────────────────────────
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

    // ── Thu hồi tin nhắn ────────────────────────────────
    socket.on("chat:recall", async (data, callback) => {
      try {
        const { messageId, conversationId, senderId } = data

        // Chỉ người gửi mới được thu hồi
        const message = await messageService.getMessage(messageId)
        if (!message) {
          return callback?.({ success: false, error: "Tin nhắn không tồn tại" })
        }
        if (message.senderId !== senderId) {
          return callback?.({ success: false, error: "Bạn không có quyền thu hồi tin nhắn này" })
        }

        // Cập nhật isDeleted trong DB
        await messageService.updateMessage(messageId, { isDeleted: true })

        // Broadcast cho cả phòng
        io.to(conversationId).emit("chat:recalled", {
          messageId,
          conversationId,
        })

        callback?.({ success: true })

      } catch (err) {
        console.error("chat:recall error:", err)
        callback?.({ success: false, error: err.message })
      }
    });

    // ── 7. Video Call Signaling ──────────────────────────────
    socket.on("video:call-user", (data) => {
      // data: { fromUserId, toUserId, conversationId, peerId, callerName, callerAvatar }
      const toSocketId = onlineUsers.get(String(data.toUserId));
      if (toSocketId) {
        io.to(toSocketId).emit("video:incoming-call", data);
      } else {
        socket.emit("video:user-offline", { toUserId: data.toUserId });
      }
    });

    socket.on("video:answer-call", (data) => {
      // data: { toUserId, peerId }
      // Lưu ý: toUserId ở đây thực chất là người GỌI ĐI ban đầu
      const toSocketId = onlineUsers.get(String(data.toUserId));
      if (toSocketId) {
        io.to(toSocketId).emit("video:call-answered", data);
      }
    });

    socket.on("video:reject-call", (data) => {
       const toSocketId = onlineUsers.get(String(data.toUserId));
       if (toSocketId) {
         io.to(toSocketId).emit("video:call-rejected", data);
       }
    });

    socket.on("video:end-call", (data) => {
       const toSocketId = onlineUsers.get(String(data.toUserId));
       if (toSocketId) {
         io.to(toSocketId).emit("video:call-ended", data);
       }
    });
  });

  return io;
};