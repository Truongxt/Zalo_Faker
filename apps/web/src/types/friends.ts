import { User } from '@/stores/authStore';

export interface FriendRequest {
    id: string;
    fromUserId: string;
    toUserId: string;
    fromUser?: User;
    message?: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

export interface Friend {
    id: string;
    fromUserId: string;
    toUserId: string;
    status: 'accepted';
    createdAt: string;
    user?: User; // The other user in the friendship
}

export interface ContactItem {
    id: string;
    user: User;
    nickname?: string;
    isFavorite: boolean;
    addedAt: string;
}
