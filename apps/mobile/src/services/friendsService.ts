import { Friends } from "@/types";
import apiClient from "./apiClient";

 class FriendsService {
    async sendFriendRequests(fromUserId: string, toUserId: string, message: string): Promise<Friends[]> {
        const response = await apiClient.post<{ data: Friends[] }>("/api/friends/requests", { fromUserId, toUserId, message });
        return response.data.data;
    }

    async acceptFriendRequest(fromUserId: string, toUserId: string): Promise<Friends> {
        const response = await apiClient.post<{ data: Friends }>("/api/friends/requests/accept", { fromUserId, toUserId });
        return response.data.data;
    }

    async getFriend(userId: string): Promise<Friends[]> {
        const response = await apiClient.get<{ data: Friends[] }>(`/api/friends/${userId}`);
        return response.data.data;
    }

    async getPendingRequests(userId: string): Promise<Friends[]> {
        const response = await apiClient.get<{ data: Friends[] }>(`/api/friends/requests/pending/${userId}`);
        return response.data.data;
    }
    async getExitingFriend(userId1: string, userId2: string): Promise<Friends | null> {
        try {
            const response = await apiClient.get<{ data: Friends }>(`/api/friends/check?userId1=${userId1}&userId2=${userId2}`);
            return response.data.data;
        } catch (error: any) {
            if (error?.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }
}
export const friendsService = new FriendsService();