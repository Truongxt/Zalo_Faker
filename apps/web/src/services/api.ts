import { useAuthStore } from '../stores/authStore';

export const baseAPI = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = useAuthStore.getState().accessToken;
    
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    
    if (!headers.has('Content-Type') && options.method !== 'GET') {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${baseAPI}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response;
};

const getAuthHeaders = (): Record<string, string> => {
    const token = useAuthStore.getState().accessToken;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const getConversation = async () => {
    const response = await fetchWithAuth(`/conversations`);
    const data = await response.json();
    return data.map((conv: any) => ({ ...conv, id: conv._id }));
}

const getMessages = async (conversationId: string) => {
    const response = await fetchWithAuth(`/messages/conversation/${conversationId}`);
    const data = await response.json();
    return data.map((msg: any) => ({ ...msg, id: msg._id }));
}

const sendMessage = async (message: any) => {
    const response = await fetchWithAuth(`/messages`, {
        method: "POST",
        body: JSON.stringify(message),
    });
    return response.json();
}

const getUsers = async () => {
    const response = await fetchWithAuth(`/users`);
    return response.json();
}

const removeGroupMember = async (groupId: string, data: { userId: string, removeUserId: string }) => {
    const response = await fetch(`${baseAPI}/groups/${groupId}/remove-member`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json();
}

const leaveGroup = async (groupId: string, data: { userId: string }) => {
    const response = await fetch(`${baseAPI}/groups/${groupId}/leave`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json();
}

const getStickers = async () => {
    const response = await fetch(`${baseAPI}/messages/stickers`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json();
}

const updateConversationBackground = async (conversationId: string, backgroundUrl: string) => {
    const response = await fetch(`${baseAPI}/conversations/${conversationId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ background: backgroundUrl })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json();
    return { ...json, id: json._id };
}

const uploadMedia = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`${baseAPI}/upload`, {
        method: "POST",
        headers: getAuthHeaders(), // Do NOT override Content-Type when sending FormData
        body: formData,
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

const getLabels = async () => {
    const response = await fetch(`${baseAPI}/labels`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

const createLabel = async (data: { name: string, color: string }) => {
    const response = await fetch(`${baseAPI}/labels`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

const updateLabel = async (id: string, data: { name?: string, color?: string }) => {
    const response = await fetch(`${baseAPI}/labels/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

const deleteChatHistory = async (conversationId: string) => {
    const response = await fetch(`${baseAPI}/messages/room/${conversationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

const createGroup = async (data: { name: string; memberIds: string[]; createdBy: string; avatar?: string }) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('memberIds', JSON.stringify(data.memberIds));
    formData.append('createdBy', data.createdBy);
    if (data.avatar) formData.append('avatar', data.avatar);

    const response = await fetch(`${baseAPI}/groups`, {
        method: 'POST',
        headers: getAuthHeaders(), // Do NOT set Content-Type with FormData
        body: formData
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return { ...json, id: json._id };
}

const updateParticipantSetting = async (
    conversationId: string,
    userId: string,
    settings: { isPinned?: boolean; isMuted?: boolean; nickname?: string; labelIds?: string[] }
) => {
    const response = await fetch(`${baseAPI}/conversations/${conversationId}/setting`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ userId, ...settings })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

const addGroupMember = async (groupId: string, data: { userId: string; newUserId: string }) => {
    const response = await fetch(`${baseAPI}/groups/${groupId}/add-member`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

const deleteLabel = async (id: string) => {
    const response = await fetch(`${baseAPI}/labels/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
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
    getStickers,
    updateConversationBackground,
    uploadMedia,
    getLabels,
    createLabel,
    updateLabel,
    deleteLabel
}