import { User, useAuthStore } from '../stores/authStore';

export const baseAPI = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = useAuthStore.getState().accessToken;
    
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    
    if (!headers.has('Content-Type') && options.method !== 'GET' && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${baseAPI}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (refreshToken) {
            try {
                const refreshResponse = await fetch(`${baseAPI}/users/refresh-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshResponse.ok) {
                    const data = await refreshResponse.json();
                    useAuthStore.getState().setAccessToken(data.accessToken);

                    // Retry original request
                    const retryHeaders = new Headers(options.headers || {});
                    retryHeaders.set("Authorization", `Bearer ${data.accessToken}`);
                    if (!retryHeaders.has('Content-Type') && options.method !== 'GET' && !(options.body instanceof FormData)) {
                        retryHeaders.set("Content-Type", "application/json");
                    }

                    return await fetch(`${baseAPI}${endpoint}`, {
                        ...options,
                        headers: retryHeaders,
                    });
                }
            } catch (err) {
                console.error('Token refresh failed:', err);
            }
        }
        
        console.warn('Session expired. Logging out...');
        useAuthStore.getState().logout();
        window.location.href = '/login';
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response;
};


export const mapUser = (u: any): User => ({
    ...u,
    id: u.userId || u.id || u._id,
    fullName: u.userName || u.fullName || 'User',
    avatarUrl: u.avartarUrl || u.avatarUrl || null,
    phoneNumber: u.phone || u.phoneNumber || '',
    birthday: u.birthday || null,
    gender: (u.gender === 'male' || u.gender === 'female' || u.gender === 'other') ? u.gender : 'other',
});

const normalizeContent = (rawContent: any) => {
    if (typeof rawContent === 'string') {
        return { text: rawContent };
    }

    if (!rawContent || typeof rawContent !== 'object') {
        return {};
    }

    return {
        text: typeof rawContent.text === 'string'
            ? rawContent.text
            : typeof rawContent.message === 'string'
                ? rawContent.message
                : typeof rawContent.content === 'string'
                    ? rawContent.content
                    : undefined,
        mediaUrl: typeof rawContent.mediaUrl === 'string'
            ? rawContent.mediaUrl
            : typeof rawContent.url === 'string'
                ? rawContent.url
                : typeof rawContent.fileUrl === 'string'
                    ? rawContent.fileUrl
                    : undefined,
        thumbnail: typeof rawContent.thumbnail === 'string' ? rawContent.thumbnail : undefined,
        fileName: typeof rawContent.fileName === 'string' ? rawContent.fileName : undefined,
        fileSize: typeof rawContent.fileSize === 'number' ? rawContent.fileSize : undefined,
        duration: typeof rawContent.duration === 'number' ? rawContent.duration : undefined,
    };
};

const normalizeMessage = (msg: any) => ({
    ...msg,
    id: msg.id || msg._id,
    content: normalizeContent(msg.content),
    reactions: Array.isArray(msg.reactions) ? msg.reactions : [],
    readBy: Array.isArray(msg.readBy) ? msg.readBy : [],
    isDeleted: Boolean(msg.isDeleted),
});

const getConversation = async () => {
    const response = await fetchWithAuth(`/conversations`);
    const data = await response.json();
    return (data || []).map((conv: any) => ({ ...conv, id: conv._id }));
}

const getMessages = async (conversationId: string) => {
    if (!conversationId || conversationId === 'undefined') return [];
    const response = await fetchWithAuth(`/messages/conversation/${conversationId}`);
    const data = await response.json();
    return (data || []).map((msg: any) => normalizeMessage(msg));
}

const sendMessage = async (message: any) => {
    const response = await fetchWithAuth(`/messages`, {
        method: "POST",
        body: JSON.stringify(message),
    });
    const data = await response.json();
    return normalizeMessage(data);
}

const getUsers = async (): Promise<User[]> => {
    const response = await fetchWithAuth(`/users`);
    const data = await response.json();
    return (data || []).map(mapUser);
}

const removeGroupMember = async (groupId: string, data: { userId: string, removeUserId: string }) => {
    if (!groupId || groupId === 'undefined') throw new Error('Invalid Group ID');
    const response = await fetchWithAuth(`/groups/${groupId}/remove-member`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response.json();
}

const leaveGroup = async (groupId: string, data: { userId: string }) => {
    if (!groupId || groupId === 'undefined') throw new Error('Invalid Group ID');
    const response = await fetchWithAuth(`/groups/${groupId}/leave`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response.json();
}

const getStickers = async () => {
    const response = await fetchWithAuth(`/messages/stickers`);
    return response.json();
}

const updateConversationBackground = async (conversationId: string, backgroundUrl: string) => {
    if (!conversationId || conversationId === 'undefined') throw new Error('Invalid Conversation ID');
    const response = await fetchWithAuth(`/conversations/${conversationId}`, {
        method: 'PUT',
        body: JSON.stringify({ background: backgroundUrl })
    });
    const json = await response.json();
    return { ...json, id: json._id };
}

const uploadMedia = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetchWithAuth(`/upload`, {
        method: "POST",
        body: formData,
    });
    return await response.json();
}

const getLabels = async () => {
    const response = await fetchWithAuth(`/labels`);
    return await response.json();
}

const createLabel = async (data: { name: string, color: string }) => {
    const response = await fetchWithAuth(`/labels`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return await response.json();
}

const updateLabel = async (id: string, data: { name?: string, color?: string }) => {
    const response = await fetchWithAuth(`/labels/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
    });
    return await response.json();
}

const deleteLabel = async (id: string) => {
    const response = await fetchWithAuth(`/labels/${id}`, {
        method: "DELETE",
    });
    return await response.json();
}

const deleteChatHistory = async (conversationId: string) => {
    const response = await fetchWithAuth(`/conversations/${conversationId}`, {
        method: "DELETE",
    });
    return await response.json();
}

const createGroup = async (data: any) => {
    const response = await fetchWithAuth(`/groups`, {
        method: "POST",
        body: JSON.stringify(data)
    });
    return await response.json();
}

const updateParticipantSetting = async (conversationId: string, userId: string, data: any) => {
    const response = await fetchWithAuth(`/conversations/${conversationId}/setting`, {
        method: "PATCH",
        body: JSON.stringify({ userId, ...data })
    });
    return await response.json();
}

const addGroupMember = async (groupId: string, data: any) => {
    const response = await fetchWithAuth(`/groups/${groupId}/add-member`, {
        method: "PUT",
        body: JSON.stringify(data)
    });
    return await response.json();
}

const getGroupSettings = async (groupId: string) => {
    if (!groupId || groupId === 'undefined') return null;
    const response = await fetchWithAuth(`/groups/${groupId}/settings`);
    return response.json();
}

const rotateGroupInviteCode = async (groupId: string) => {
    const response = await fetchWithAuth(`/groups/${groupId}/invite/rotate`, {
        method: "POST",
    });
    return response.json();
}

const updateGroupInviteSettings = async (groupId: string, data: { approvalRequired: boolean }) => {
    const response = await fetchWithAuth(`/groups/${groupId}/settings/invite`, {
        method: "PATCH",
        body: JSON.stringify(data)
    });
    return response.json();
}

const joinGroupByInviteCode = async (inviteCode: string) => {
    const response = await fetchWithAuth(`/groups/join-by-invite`, {
        method: "POST",
        body: JSON.stringify({ inviteCode })
    });
    return response.json();
}

const getGroupJoinRequests = async (groupId: string, includeResolved = false) => {
    const response = await fetchWithAuth(
        `/groups/${groupId}/join-requests${includeResolved ? "?includeResolved=true" : ""}`
    );
    return response.json();
}

const reviewGroupJoinRequest = async (
    groupId: string,
    requestId: string,
    action: "approve" | "reject"
) => {
    const response = await fetchWithAuth(`/groups/${groupId}/join-requests/${requestId}/review`, {
        method: "POST",
        body: JSON.stringify({ action })
    });
    return response.json();
}

const updateGroupPermissions = async (
    groupId: string,
    data: { sendMedia?: string; pinMessage?: string; sendAnnouncement?: string }
) => {
    const response = await fetchWithAuth(`/groups/${groupId}/settings/permissions`, {
        method: "PATCH",
        body: JSON.stringify(data)
    });
    return response.json();
}

const pinGroupMessage = async (groupId: string, messageId: string) => {
    const response = await fetchWithAuth(`/groups/${groupId}/pin-message`, {
        method: "PUT",
        body: JSON.stringify({ messageId })
    });
    return response.json();
}

const unpinGroupMessage = async (groupId: string) => {
    const response = await fetchWithAuth(`/groups/${groupId}/pin-message`, {
        method: "DELETE"
    });
    return response.json();
}

const getUserByPhone = async (phone: string): Promise<User> => {
    const response = await fetchWithAuth(`/users/phone/${phone}`);
    const data = await response.json();
    return mapUser(data);
}

const getFriends = async (userId: string): Promise<User[]> => {
    if (!userId || userId === 'undefined') return [];
    const response = await fetchWithAuth(`/friends/${userId}`);
    const result = await response.json();
    return (result.data || []).map(mapUser);
}

export {
    getConversation,
    getMessages,
    sendMessage,
    getUsers,
    deleteChatHistory,
    createGroup,
    updateParticipantSetting,
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    getGroupSettings,
    rotateGroupInviteCode,
    updateGroupInviteSettings,
    joinGroupByInviteCode,
    getGroupJoinRequests,
    reviewGroupJoinRequest,
    updateGroupPermissions,
    pinGroupMessage,
    unpinGroupMessage,
    getStickers,
    updateConversationBackground,
    uploadMedia,
    getLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    getUserByPhone,
    getFriends
}
