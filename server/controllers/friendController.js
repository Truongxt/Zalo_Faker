const friendService = require("../services/friendService");
const { emitToUser } = require("../utils/socketEmitter");

const FriendController = {

  // gửi lời mời kết bạn
 async sendFriendRequest(req, res) {
  try {
    const { fromUserId, toUserId, message } = req.body;

    const existing = await friendService.getExitingFriend(fromUserId, toUserId);

    if (existing) {
      return res.status(409).json({
        message: "Friend request already exists",
        data: existing
      });
    }

    const result = await friendService.sendFriendRequest(fromUserId, toUserId, message);

    emitToUser(toUserId, "friend:request_received", {
      request: result,
      fromUserId: Number(fromUserId),
      toUserId: Number(toUserId),
    });

    return res.status(201).json({
      message: "Friend request sent",
      data: result
    });

  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      message: error.message
    });
  }
},

  // chấp nhận lời mời
  async acceptFriendRequest(req, res) {
    try {
      const { fromUserId, toUserId } = req.body;
      console.log("Accept request body:", { fromUserId, toUserId });

      const result = await friendService.acceptFriendRequest(fromUserId, toUserId);

      emitToUser(fromUserId, "friend:request_accepted", {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
      });
      emitToUser(toUserId, "friend:request_accepted", {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
      });

      res.status(200).json({
        message: "Friend request accepted",
        data: result
      });

    } catch (error) {
      console.error("Accept error:", error.message);
      res.status(400).json({
        message: error.message
      });
    }
  },

  // lấy danh sách bạn
  async getFriends(req, res) {
    try {
      const { userId } = req.params;

      const friends = await friendService.getFriends(userId);

      res.status(200).json({
        data: friends
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  },
  async getPendingRequests(req, res) {
    try {
      const { userId } = req.params;

      const pendingRequests = await friendService.getPendingRequests(userId);

      res.status(200).json({
        data: pendingRequests
      });

    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  },
async getExitingFriend(req, res) {
    try {
      const { userId1, userId2 } = req.query;

      if (!userId1 || !userId2) {
        return res.status(400).json({
          message: "userId1 and userId2 are required"
        });
      }

      if (Number.isNaN(Number(userId1)) || Number.isNaN(Number(userId2))) {
        return res.status(400).json({
          message: "userId1 and userId2 must be valid numbers"
        });
      }

      const friend = await friendService.getExitingFriend(userId1, userId2);

      if (!friend) {
        return res.status(404).json({
          message: "No friend relationship found"
        });
      }
      res.status(200).json({
        data: friend
      });
    } catch (error) {
      res.status(500).json({
        message: error.message
      });
    }
  },

  // từ chối lời mời kết bạn
  async rejectFriendRequest(req, res) {
    try {
      const { fromUserId, toUserId } = req.body;

      if (!fromUserId || !toUserId) {
        return res.status(400).json({ message: "fromUserId và toUserId là bắt buộc" });
      }

      await friendService.rejectFriendRequest(fromUserId, toUserId);

      emitToUser(fromUserId, "friend:request_rejected", {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
      });
      emitToUser(toUserId, "friend:request_rejected", {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
      });

      res.status(200).json({ message: "Đã từ chối lời mời kết bạn" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  ,

  async removeFriend(req, res) {
    try {
      const actorId = Number(req.user?.userId);
      const friendId = Number(req.params.friendId);

      if (!actorId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await friendService.removeFriend(actorId, friendId);

      const io = req.app.get("io");
      if (io) {
        io.to(`user:${actorId}`).emit("friend:removed", { userId: actorId, friendId });
        io.to(`user:${friendId}`).emit("friend:removed", { userId: friendId, friendId: actorId });
      }

      return res.status(200).json({
        message: "Unfriended successfully",
        data: result,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  },

  async blockUser(req, res) {
    try {
      const actorId = Number(req.user?.userId);
      const targetUserId = Number(req.params.targetUserId);
      const message = req.body?.message || "";

      if (!actorId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await friendService.blockUser(actorId, targetUserId, message);

      const io = req.app.get("io");
      if (io) {
        io.to(`user:${actorId}`).emit("friend:blocked", { userId: actorId, targetUserId });
        io.to(`user:${targetUserId}`).emit("friend:blocked_by", { userId: targetUserId, blockedByUserId: actorId });
      }

      return res.status(200).json({
        message: "User blocked successfully",
        data: result,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  },

  async unblockUser(req, res) {
    try {
      const actorId = Number(req.user?.userId);
      const targetUserId = Number(req.params.targetUserId);

      if (!actorId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await friendService.unblockUser(actorId, targetUserId);

      const io = req.app.get("io");
      if (io) {
        io.to(`user:${actorId}`).emit("friend:unblocked", { userId: actorId, targetUserId });
        io.to(`user:${targetUserId}`).emit("friend:unblocked_by", {
          userId: targetUserId,
          unblockedByUserId: actorId,
        });
      }

      return res.status(200).json({
        message: "User unblocked successfully",
        data: result,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  },

  async getBlockedUsers(req, res) {
    try {
      const actorId = Number(req.user?.userId);
      const userId = Number(req.params.userId);

      if (!actorId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (actorId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const users = await friendService.getBlockedUsers(userId);
      return res.status(200).json({ data: users });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ message: error.message });
    }
  }

}

module.exports =  FriendController;
