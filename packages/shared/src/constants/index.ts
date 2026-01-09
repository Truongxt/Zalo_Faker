// Constants shared across web and mobile

// API endpoints
export const API_ENDPOINTS = {
    AUTH: {
        REGISTER: '/auth/register',
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        REFRESH: '/auth/refresh',
    },
    USERS: {
        BASE: '/users',
        PROFILE: (id: string) => `/users/${id}`,
        SEARCH: '/users/search',
    },
    CONVERSATIONS: {
        BASE: '/conversations',
        DETAIL: (id: string) => `/conversations/${id}`,
        MESSAGES: (id: string) => `/conversations/${id}/messages`,
    },
    GROUPS: {
        BASE: '/groups',
        DETAIL: (id: string) => `/groups/${id}`,
        MEMBERS: (id: string) => `/groups/${id}/members`,
    },
    MEDIA: {
        IMAGE: '/media/image',
        VIDEO: '/media/video',
        DOCUMENT: '/media/document',
        AVATAR: '/media/avatar',
    },
    AI: {
        CHAT: '/ai/chat',
        SUGGEST: '/ai/suggest-replies',
        TRANSLATE: '/ai/translate',
        SUMMARIZE: '/ai/summarize',
    },
}

// Socket events
export const SOCKET_EVENTS = {
    // Chat events
    CHAT_SEND: 'chat:send',
    CHAT_MESSAGE: 'chat:message',
    CHAT_TYPING: 'chat:typing',
    CHAT_READ: 'chat:read',
    CHAT_DELETE: 'chat:delete',
    CHAT_DELETED: 'chat:deleted',
    CHAT_REACTION: 'chat:reaction',

    // Call events
    CALL_INITIATE: 'call:initiate',
    CALL_INCOMING: 'call:incoming',
    CALL_ACCEPT: 'call:accept',
    CALL_ACCEPTED: 'call:accepted',
    CALL_REJECT: 'call:reject',
    CALL_REJECTED: 'call:rejected',
    CALL_END: 'call:end',
    CALL_ENDED: 'call:ended',
    CALL_ICE_CANDIDATE: 'call:ice-candidate',

    // Presence events
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
    PRESENCE_STATUS: 'presence:status-changed',
}

// Message limits
export const MESSAGE_LIMITS = {
    MAX_TEXT_LENGTH: 5000,
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
}

// Supported file types
export const SUPPORTED_FILE_TYPES = {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    VIDEOS: ['video/mp4', 'video/webm', 'video/quicktime'],
    DOCUMENTS: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
    ],
}

// Emojis for reactions
export const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '😡']
