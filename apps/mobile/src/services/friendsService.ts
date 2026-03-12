import { Friends } from "@/types";
import apiClient from "./apiClient";

 class FriendsService {
    async sendFriendRequests(fromUserId: number, toUserId: number, message: string): Promise<Friends[]> {
        const response = await apiClient.post<{ data: Friends[] }>("/api/friends/requests", { fromUserId, toUserId, message });
        return response.data.data;
    }

    async acceptFriendRequest(fromUserId: number, toUserId: number): Promise<Friends> {
        const response = await apiClient.post<{ data: Friends }>("/api/friends/requests/accept", { fromUserId, toUserId });
        return response.data.data;
    }

    async getFriend(userId: number): Promise<Friends[]> {
        const response = await apiClient.get<{ data: Friends[] }>(`/api/friends/${userId}`);
        return response.data.data;
    }

    async getPendingRequests(userId: number): Promise<Friends[]> {
        const response = await apiClient.get<{ data: Friends[] }>(`/api/friends/requests/pending/${userId}`);
        return response.data.data;
    }
}
export const friendsService = new FriendsService();