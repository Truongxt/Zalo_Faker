import { fetchWithAuth } from './api';
import { FriendRequest, Friend } from '@/types/friends';

export const friendsService = {
    async getFriend(userId: string): Promise<Friend[]> {
        const [friendsResponse, usersResponse] = await Promise.all([
            fetchWithAuth(`/friends/${userId}`),
            fetchWithAuth(`/users`)
        ]);
        const friendsData = (await friendsResponse.json()).data || [];
        const allUsers = await usersResponse.json();
        
        const uniqueFriendIds = new Set<string>();
        const uniqueFriends: Friend[] = [];

        friendsData.forEach((f: any) => {
            const friendUserId = String(f.fromUserId) === String(userId)
                ? String(f.toUserId)
                : String(f.fromUserId);
            
            if (!uniqueFriendIds.has(friendUserId)) {
                uniqueFriendIds.add(friendUserId);
                const friendUser = allUsers.find((u: any) => String(u.userId) === String(friendUserId));
                
                uniqueFriends.push({
                    ...f,
                    id: f._id,
                    user: friendUser ? {
                        id: friendUser.userId,
                        fullName: friendUser.userName,
                        avatarUrl: friendUser.avartarUrl,
                        status: friendUser.status
                    } : null
                });
            }
        });

        return uniqueFriends;
    },

    async getPendingRequests(userId: string): Promise<FriendRequest[]> {
        const [requestsResponse, usersResponse] = await Promise.all([
            fetchWithAuth(`/friends/requests/pending/${userId}`),
            fetchWithAuth(`/users`)
        ]);
        const requestsData = (await requestsResponse.json()).data || [];
        const allUsers = await usersResponse.json();

        return requestsData.map((f: any) => {
            const fromUser = allUsers.find((u: any) => String(u.userId) === String(f.fromUserId));

            return {
                ...f,
                id: f._id,
                fromUser: fromUser ? {
                    id: fromUser.userId,
                    fullName: fromUser.userName,
                    avatarUrl: fromUser.avartarUrl,
                    status: fromUser.status
                } : null
            };
        });
    },

    async acceptFriendRequest(fromUserId: string, toUserId: string): Promise<any> {
        const response = await fetchWithAuth(`/friends/requests/accept`, {
            method: 'POST',
            body: JSON.stringify({ fromUserId, toUserId })
        });
        return response.json();
    },

    async rejectFriendRequest(fromUserId: string, toUserId: string): Promise<any> {
        const response = await fetchWithAuth(`/friends/requests/reject`, {
            method: 'POST',
            body: JSON.stringify({ fromUserId, toUserId })
        });
        return response.json();
    },

    async cancelFriendRequest(fromUserId: string, toUserId: string): Promise<any> {
        return this.rejectFriendRequest(fromUserId, toUserId);
    },

    async sendFriendRequest(fromUserId: string, toUserId: string, message: string): Promise<any> {
        const response = await fetchWithAuth(`/friends/requests`, {
            method: 'POST',
            body: JSON.stringify({ fromUserId, toUserId, message })
        });
        return response.json();
    },

    async checkFriendship(userId1: string, userId2: string): Promise<Friend | null> {
        try {
            const response = await fetchWithAuth(`/friends/check?userId1=${userId1}&userId2=${userId2}`);
            const data = await response.json();
            return { ...data.data, id: data.data._id };
        } catch (error: any) {
            return null;
        }
    },

    async removeFriend(friendId: string): Promise<any> {
        const response = await fetchWithAuth(`/friends/${friendId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async blockUser(targetUserId: string, message = ''): Promise<any> {
        const response = await fetchWithAuth(`/friends/block/${targetUserId}`, {
            method: 'POST',
            body: JSON.stringify({ message })
        });
        return response.json();
    },

    async unblockUser(targetUserId: string): Promise<any> {
        const response = await fetchWithAuth(`/friends/block/${targetUserId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async getBlockedUsers(userId: string): Promise<any[]> {
        const response = await fetchWithAuth(`/friends/blocked/${userId}`);
        const data = await response.json();
        return data?.data || [];
    },
};
