import { Friends } from "@/types";
import { apiFetch } from "./fetchClient";

type FriendsApiResponse = {
  data: Friends[];
};

type FriendApiResponse = {
  data: Friends;
};

class FriendsService {
  async sendFriendRequests(
    fromUserId: string,
    toUserId: string,
    message: string,
  ): Promise<Friends[]> {
    const response = await apiFetch<FriendsApiResponse>("/api/friends/requests", {
      method: "POST",
      body: { fromUserId, toUserId, message },
    });
    return response.data || [];
  }

  async acceptFriendRequest(fromUserId: string, toUserId: string): Promise<Friends> {
    const response = await apiFetch<FriendApiResponse>("/api/friends/requests/accept", {
      method: "POST",
      body: { fromUserId, toUserId },
    });
    return response.data;
  }

  async getFriend(userId: string): Promise<Friends[]> {
    const response = await apiFetch<FriendsApiResponse>(`/api/friends/${userId}`, {
      method: "GET",
    });
    const raw = response.data || [];

    return raw
      .map((item: any) => {
        // Case 1: backend returns friendship records
        if (item?.fromUserId !== undefined && item?.toUserId !== undefined) {
          return item as Friends;
        }

        // Case 2: backend returns user profiles directly
        if (item?.userId !== undefined) {
          return {
            id: `${userId}-${String(item.userId)}`,
            fromUserId: String(userId),
            toUserId: String(item.userId),
            fromUser: {
              id: String(item.userId),
              email: item.email ?? null,
              phone: item.phone ?? null,
              fullName: item.userName || item.fullName || "Unknown",
              avatarUrl: item.avartarUrl || item.avatarUrl || null,
              birthday: item.birthday ?? null,
              gender: item.gender ?? null,
              bio: item.bio ?? null,
              status:
                item.presenceStatus === "online" || item.presenceStatus === "offline"
                  ? item.presenceStatus
                  : item.status === "active"
                    ? "online"
                    : "offline",
              lastSeen: item.lastActiveAt ?? null,
              createdAt: item.createdAt || new Date().toISOString(),
            },
            status: "accepted",
            createdAt: item.createdAt || new Date().toISOString(),
          } as Friends;
        }

        return null;
      })
      .filter(Boolean) as Friends[];
  }

  async getPendingRequests(userId: string): Promise<Friends[]> {
    const response = await apiFetch<FriendsApiResponse>(`/api/friends/requests/pending/${userId}`, {
      method: "GET",
    });
    return response.data || [];
  }

  async getExitingFriend(userId1: string, userId2: string): Promise<Friends | null> {
    try {
      const response = await apiFetch<FriendApiResponse>(
        `/api/friends/check?userId1=${encodeURIComponent(userId1)}&userId2=${encodeURIComponent(userId2)}`,
        { method: "GET" },
      );
      return response.data;
    } catch (error: any) {
      if (error?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async rejectFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
    await apiFetch("/api/friends/requests/reject", {
      method: "POST",
      body: { fromUserId, toUserId },
    });
  }

  async removeFriend(friendId: string): Promise<void> {
    await apiFetch(`/api/friends/${friendId}`, {
      method: "DELETE",
    });
  }

  async blockUser(targetUserId: string, message = ""): Promise<void> {
    await apiFetch(`/api/friends/block/${targetUserId}`, {
      method: "POST",
      body: { message },
    });
  }

  async unblockUser(targetUserId: string): Promise<void> {
    await apiFetch(`/api/friends/block/${targetUserId}`, {
      method: "DELETE",
    });
  }

  async getBlockedUsers(userId: string): Promise<Friends[]> {
    const response = await apiFetch<FriendsApiResponse>(`/api/friends/blocked/${userId}`, {
      method: "GET",
    });
    return response.data || [];
  }
}

export const friendsService = new FriendsService();
