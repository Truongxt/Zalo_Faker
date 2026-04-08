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
    return response.data || [];
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
}

export const friendsService = new FriendsService();
