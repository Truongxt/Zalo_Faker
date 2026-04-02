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
        const { conversationId, senderId, type, content, replyTo } = data;

        // Lưu vào DynamoDB
        const saved = await messageService.createMessage({
          conversationId,
          senderId,
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
            content: content.text || "[Media]",
            type: type || "text",
            senderId,
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
    socket.on("chat:read", ({ conversationId, messageId, userId }) => {
      socket.to(conversationId).emit("chat:read", {
        conversationId,
        messageId,
        userId,
      });
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
          userId,
          emoji
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
  });

  return io;
};