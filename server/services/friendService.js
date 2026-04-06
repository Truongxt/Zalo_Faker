const friendRepository = require("../repository/friendsRepository")

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const FriendService = {

  // gửi lời mời kết bạn
  async sendFriendRequest(fromUserId, toUserId, message) {

    fromUserId = Number(fromUserId);
    toUserId = Number(toUserId);

    if (fromUserId === toUserId) {
      throw createError("You cannot add yourself as a friend", 400);
    }

    const existing = await friendRepository.getExitingFriend(fromUserId, toUserId);

    if (existing) {
      if (existing.status === "accepted") {
        throw createError("You are already friends", 409);
      }

      throw createError("Friend request already exists", 409);
    }

    return await friendRepository.createFriendRequest(fromUserId, toUserId, message);
  },    

  // chấp nhận lời mời
  async acceptFriendRequest(fromUserId, toUserId) {

    fromUserId = Number(fromUserId);
    toUserId = Number(toUserId);

    const request = await friendRepository.getFriend(fromUserId, toUserId);

    if (!request) {
      throw new Error("Friend request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request already processed");
    }

    return await friendRepository.acceptRequest(fromUserId, toUserId);
  },

  // lấy danh sách bạn
  async getFriends(userId) {
    return await friendRepository.getFriends(Number(userId));
  },

  // lấy danh sách request đang chờ
  async getPendingRequests(userId) {
    return await friendRepository.getPendingRequests(Number(userId));
  },
  async getExitingFriend(fromUserId, toUserId) {
    return await friendRepository.getExitingFriend(Number(fromUserId), Number(toUserId));
  },

  // từ chối lời mời kết bạn
  async rejectFriendRequest(fromUserId, toUserId) {
    fromUserId = Number(fromUserId);
    toUserId = Number(toUserId);

    const request = await friendRepository.getFriend(fromUserId, toUserId);
    if (!request) {
      throw new Error("Friend request not found");
    }

    await friendRepository.rejectRequest(fromUserId, toUserId);
  }

}

module.exports =  FriendService;