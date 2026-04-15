const friendRepository = require("../repository/friendsRepository")
const userRepository = require("../repository/userRepository")

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
      if (existing.status === "blocked") {
        if (Number(existing.fromUserId) === toUserId) {
          throw createError("You are blocked by this user", 403);
        }
        throw createError("You blocked this user. Unblock first.", 400);
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

  // lấy danh sách bạn (kèm profile)
  async getFriends(userId) {
    const friendships = await friendRepository.getFriends(Number(userId));
    
    // Ánh xạ thành danh sách user profile
    const friends = await Promise.all(friendships.map(async (f) => {
      const friendId = f.fromUserId === Number(userId) ? f.toUserId : f.fromUserId;
      return await userRepository.getById(friendId);
    }));

    return friends.filter(u => u != null);
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
  },

  async removeFriend(userId, friendId) {
    const fromId = Number(userId);
    const toId = Number(friendId);

    if (!fromId || !toId) {
      throw createError("userId and friendId are required", 400);
    }

    if (fromId === toId) {
      throw createError("Invalid friendId", 400);
    }

    const [direct, reverse] = await Promise.all([
      friendRepository.getDirectFriend(fromId, toId),
      friendRepository.getDirectFriend(toId, fromId),
    ]);

    const acceptedRelations = [direct, reverse].filter(
      (relation) => relation && relation.status === "accepted",
    );

    if (!acceptedRelations.length) {
      throw createError("Friendship not found", 404);
    }

    await Promise.all(
      acceptedRelations.map((relation) =>
        friendRepository.deleteDirectFriend(relation.fromUserId, relation.toUserId),
      ),
    );

    return { removed: true };
  },

  async blockUser(userId, targetUserId, message = "") {
    const fromId = Number(userId);
    const toId = Number(targetUserId);

    if (!fromId || !toId) {
      throw createError("userId and targetUserId are required", 400);
    }

    if (fromId === toId) {
      throw createError("You cannot block yourself", 400);
    }

    const targetUser = await userRepository.getById(toId);
    if (!targetUser) {
      throw createError("Target user not found", 404);
    }

    const [direct, reverse] = await Promise.all([
      friendRepository.getDirectFriend(fromId, toId),
      friendRepository.getDirectFriend(toId, fromId),
    ]);

    const relationsToDelete = [direct, reverse].filter(
      (relation) => relation && relation.status !== "blocked",
    );

    if (relationsToDelete.length) {
      await Promise.all(
        relationsToDelete.map((relation) =>
          friendRepository.deleteDirectFriend(relation.fromUserId, relation.toUserId),
        ),
      );
    }

    const blockedRelation = await friendRepository.upsertBlock(fromId, toId, message);
    return blockedRelation;
  },

  async unblockUser(userId, targetUserId) {
    const fromId = Number(userId);
    const toId = Number(targetUserId);

    if (!fromId || !toId) {
      throw createError("userId and targetUserId are required", 400);
    }

    const direct = await friendRepository.getDirectFriend(fromId, toId);
    if (!direct || direct.status !== "blocked") {
      throw createError("Blocked user not found", 404);
    }

    await friendRepository.deleteDirectFriend(fromId, toId);
    return { unblocked: true };
  },

  async getBlockedUsers(userId) {
    const uid = Number(userId);
    if (!uid) {
      throw createError("userId is required", 400);
    }

    const relations = await friendRepository.getBlockedUsers(uid);
    const users = await Promise.all(
      relations.map(async (relation) => {
        const targetUser = await userRepository.getById(relation.toUserId);
        if (!targetUser) return null;
        return {
          ...targetUser,
          blockedAt: relation.updatedAt || relation.createdAt,
        };
      }),
    );

    return users.filter(Boolean);
  },

  async getBlockStateBetweenUsers(userId, targetUserId) {
    const fromId = Number(userId);
    const toId = Number(targetUserId);

    if (!fromId || !toId) {
      throw createError("userId and targetUserId are required", 400);
    }

    const [direct, reverse] = await Promise.all([
      friendRepository.getDirectFriend(fromId, toId),
      friendRepository.getDirectFriend(toId, fromId),
    ]);

    const blockedByActor =
      Boolean(direct) && String(direct.status) === "blocked";
    const blockedByTarget =
      Boolean(reverse) && String(reverse.status) === "blocked";

    return {
      blockedByActor,
      blockedByTarget,
      direct,
      reverse,
    };
  },

  async ensureCanMessageBetweenUsers(userId, targetUserId) {
    const state = await this.getBlockStateBetweenUsers(userId, targetUserId);

    if (state.blockedByActor) {
      const error = createError("You blocked this user. Unblock first.", 403);
      error.code = "BLOCKED_BY_SELF";
      throw error;
    }

    if (state.blockedByTarget) {
      const error = createError("You are blocked by this user", 403);
      error.code = "BLOCKED_BY_TARGET";
      throw error;
    }
  },

}

module.exports =  FriendService;
