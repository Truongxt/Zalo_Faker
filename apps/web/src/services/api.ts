import { useAuthStore } from '@/stores/authStore'

const baseAPI = "http://localhost:3000/api";

const getAuthHeaders = (): Record<string, string> => {
    const token = useAuthStore.getState().accessToken;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const getConversation = async () => {
    const response = await fetch(`${baseAPI}/conversations`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json();
    // DynamoDB trả về _id, frontend dùng id → cần map
    return data.map((conv: any) => ({ ...conv, id: conv._id }));
}

const getMessages = async (conversationId: string) => {
    const response = await fetch(`${baseAPI}/messages/conversation/${conversationId}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json();
    // DynamoDB trả về _id, frontend dùng id → cần map
    return data.map((msg: any) => ({ ...msg, id: msg._id }));
}

const sendMessage = async (message: any) => {
    const response = await fetch(`${baseAPI}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
        },
        body: JSON.stringify(message),
    });
    return response.json();
}

const getUsers = async () => {
    const response = await fetch(`${baseAPI}/users`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json();
}

const deleteChatHistory = async (roomId: string) => {
    const response = await fetch(`${baseAPI}/messages/room/${roomId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json();
}

const createGroup = async (groupData: { name: string, memberIds: string[], createdBy: string }) => {
    const response = await fetch(`${baseAPI}/groups`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify(groupData)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json();
    return { ...data, id: data._id };
}

const updateParticipantSetting = async (
    conversationId: string,
    userId: string,
    data: { isPinned?: boolean, isMuted?: boolean, nickname?: string }
) => {
    const response = await fetch(`${baseAPI}/conversations/${conversationId}/setting`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ userId, ...data })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json();
    return { ...json, id: json._id };
}

const addGroupMember = async (groupId: string, data: { userId: string, newUserId: string }) => {
    const response = await fetch(`${baseAPI}/groups/${groupId}/add-member`, {
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
    uploadMedia
}