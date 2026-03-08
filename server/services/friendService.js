const friendRepository = require("../repository/friendsRepository")

const FriendService = {

  // gửi lời mời kết bạn
  async sendFriendRequest(userId, friendId) {

    if (userId === friendId) {
      throw new Error("You cannot add yourself as a friend");
    }

    const existing = await friendRepository.getFriend(userId, friendId);

    if (existing) {
      throw new Error("Friend request already exists");
    }

    return await friendRepository.createFriendRequest(userId, friendId);
  },    

  // chấp nhận lời mời
  async acceptFriendRequest(userId, friendId) {

    const request = await friendRepository.getFriend(userId, friendId);

    if (!request) {
      throw new Error("Friend request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request already processed");
    }

    return await friendRepository.acceptRequest(userId, friendId);
  },

  // lấy danh sách bạn
  async getFriends(userId) {
    return await friendRepository.getFriends(userId);
  },

  // lấy danh sách request đang chờ
  async getPendingRequests(userId) {

    const friends = await friendRepository.getFriends(userId);

    return friends.filter(f => f.status === "pending");
  }

}

module.exports =  FriendService;