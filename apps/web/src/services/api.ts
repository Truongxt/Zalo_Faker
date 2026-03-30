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

export {
    getConversation,
    getMessages,
    sendMessage,
    getUsers
}