const friendService = require("../services/friendService");

const FriendController = {

  // gửi lời mời kết bạn
  async sendFriendRequest(req, res) {
    try {
      const { userId, friendId } = req.body;

      const result = await friendService.sendFriendRequest(userId, friendId);

      res.status(201).json({
        message: "Friend request sent",
        data: result
      });

    } catch (error) {
      res.status(400).json({
        message: error.message
      });
    }
  },

  // chấp nhận lời mời
  async acceptFriendRequest(req, res) {
    try {
      const { userId, friendId } = req.body;

      const result = await friendService.acceptFriendRequest(userId, friendId);

      res.status(200).json({
        message: "Friend request accepted",
        data: result
      });

    } catch (error) {
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
  }

}

module.exports =  FriendController;