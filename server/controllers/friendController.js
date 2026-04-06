const friendService = require("../services/friendService");

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

      res.status(200).json({ message: "Đã từ chối lời mời kết bạn" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

}

module.exports =  FriendController;