import { User, useAuthStore } from '../stores/authStore';

const fallbackApiBase =
    typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';
const configuredApiBase = String(import.meta.env.VITE_API_URL || '').trim();
const isConfiguredLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\/?$/i.test(configuredApiBase);
const isRunningOnLocalhost =
    typeof window !== 'undefined'
    && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

export const baseAPI =
    configuredApiBase && !(isConfiguredLocalApi && !isRunningOnLocalhost)
        ? configuredApiBase
        : fallbackApiBase;

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


const resolvePresenceStatus = (presenceStatus?: string | null, fallbackStatus?: string | null) => {
    const presence = String(presenceStatus || '').trim().toLowerCase();
    if (presence === 'online' || presence === 'offline') return presence;

    const fallback = String(fallbackStatus || '').trim().toLowerCase();
    if (fallback === 'online' || fallback === 'offline') return fallback;

    return 'offline';
};

const normalizeParticipantPresence = (participant: any) => ({
    ...participant,
    status: resolvePresenceStatus(participant?.presenceStatus, participant?.status),
    lastSeen: participant?.lastActiveAt || participant?.lastSeen || null,
});

export const mapUser = (u: any): User => ({
    ...u,
    id: u.userId || u.id || u._id,
    fullName: u.userName || u.fullName || u.name || 'User',
    avatarUrl: u.avartarUrl || u.avatarUrl || null,
    phoneNumber: u.phone || u.phoneNumber || '',
    birthday: u.birthday || null,
    gender: (u.gender === 'male' || u.gender === 'female' || u.gender === 'other') ? u.gender : 'other',
    status: resolvePresenceStatus(u.presenceStatus, u.status),
    lastSeen: u.lastActiveAt || u.lastSeen || null,
});

type ParsedCallPayload = {
    callType: 'audio' | 'video'
    callStatus: string
    duration?: number
}

const normalizeCallType = (value: unknown): ParsedCallPayload['callType'] | undefined => {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'video') return 'video'
    if (normalized === 'audio' || normalized === 'voice') return 'audio'
    return undefined
}

const normalizeCallStatus = (value: unknown): string | undefined => {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return undefined
    if (normalized === 'ended') return 'finished'
    return normalized
}

const parseCallPayloadObject = (value: Record<string, unknown>): ParsedCallPayload | null => {
    const callType = normalizeCallType(value.callType)
    const callStatus = normalizeCallStatus(value.status || value.callStatus)
    if (!callType || !callStatus) return null

    const duration = typeof value.duration === 'number' && Number.isFinite(value.duration)
        ? Math.max(0, Math.floor(value.duration))
        : undefined

    return { callType, callStatus, duration }
}

const parseCallPayload = (value: unknown): ParsedCallPayload | null => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null

        try {
            const parsed = JSON.parse(trimmed)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
            return parseCallPayloadObject(parsed as Record<string, unknown>)
        } catch {
            return null
        }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) return null

    const direct = parseCallPayloadObject(value as Record<string, unknown>)
    if (direct) return direct

    const textCandidate =
        typeof (value as Record<string, unknown>).text === 'string'
            ? (value as Record<string, unknown>).text
            : typeof (value as Record<string, unknown>).message === 'string'
                ? (value as Record<string, unknown>).message
                : typeof (value as Record<string, unknown>).content === 'string'
                    ? (value as Record<string, unknown>).content
                    : ''

    return textCandidate ? parseCallPayload(textCandidate) : null
}

const looksLikeMediaUrl = (value: string): boolean => {
    const normalized = value.trim()
    if (!normalized) return false

    if (/^https?:\/\//i.test(normalized)) return true
    if (/^data:image\//i.test(normalized)) return true
    if (/^blob:/i.test(normalized)) return true
    if (/^\/(uploads|images|media|stickers)\//i.test(normalized)) return true

    return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(normalized)
}

const normalizeContent = (rawContent: any) => {
    const parsedCall = parseCallPayload(rawContent)

    if (
        rawContent
        && typeof rawContent === 'object'
        && !Array.isArray(rawContent)
        && rawContent.poll
        && typeof rawContent.poll === 'object'
        && !Array.isArray(rawContent.poll)
    ) {
        return {
            poll: rawContent.poll,
            text: typeof rawContent.text === 'string'
                ? rawContent.text
                : typeof rawContent.poll.question === 'string'
                    ? rawContent.poll.question
                    : undefined,
        }
    }

    if (
        rawContent
        && typeof rawContent === 'object'
        && !Array.isArray(rawContent)
        && typeof rawContent.question === 'string'
        && Array.isArray(rawContent.options)
    ) {
        return {
            poll: rawContent,
            text: rawContent.question,
        }
    }

    if (typeof rawContent === 'string') {
        const mediaUrl = looksLikeMediaUrl(rawContent) ? rawContent : undefined
        return {
            text: mediaUrl ? undefined : rawContent,
            mediaUrl,
            callType: parsedCall?.callType,
            callStatus: parsedCall?.callStatus,
            duration: parsedCall?.duration,
        };
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
        duration: typeof rawContent.duration === 'number'
            ? rawContent.duration
            : parsedCall?.duration,
        callType: parsedCall?.callType,
        callStatus: parsedCall?.callStatus,
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
    return (data || []).map((conv: any) => ({
        ...conv,
        id: conv._id,
        participants: Array.isArray(conv.participants)
            ? conv.participants.map(normalizeParticipantPresence)
            : [],
    }));
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

const votePoll = async (messageId: string, optionIds: string[]) => {
    const response = await fetchWithAuth(`/messages/${messageId}/poll/vote`, {
        method: "POST",
        body: JSON.stringify({ optionIds }),
    });
    const data = await response.json();
    return normalizeMessage(data);
}

const addPollOption = async (messageId: string, text: string) => {
    const response = await fetchWithAuth(`/messages/${messageId}/poll/options`, {
        method: "POST",
        body: JSON.stringify({ text }),
    });
    const data = await response.json();
    return normalizeMessage(data);
}

const removePollOption = async (messageId: string, optionId: string) => {
    const response = await fetchWithAuth(`/messages/${messageId}/poll/options/${optionId}`, {
        method: "DELETE",
    });
    const data = await response.json();
    return normalizeMessage(data);
}

const deleteMessageForMe = async (messageId: string) => {
    const response = await fetchWithAuth(`/messages/${messageId}/delete-for-me`, {
        method: "DELETE",
    });
    return response.json();
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

const leaveGroup = async (groupId: string, data: { userId: string; newAdminUserId?: string }) => {
    if (!groupId || groupId === 'undefined') throw new Error('Invalid Group ID');
    const response = await fetchWithAuth(`/groups/${groupId}/leave`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response.json();
}

const transferAdmin = async (groupId: string, data: { userId: string; newAdminUserId: string }) => {
    if (!groupId || groupId === 'undefined') throw new Error('Invalid Group ID');
    const response = await fetchWithAuth(`/groups/${groupId}/transfer-admin`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response.json();
}

const appointDeputy = async (groupId: string, data: { userId: string; deputyUserId: string }) => {
    if (!groupId || groupId === 'undefined') throw new Error('Invalid Group ID');
    const response = await fetchWithAuth(`/groups/${groupId}/appoint-deputy`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response.json();
}

const revokeDeputy = async (groupId: string, data: { userId: string; deputyUserId: string }) => {
    if (!groupId || groupId === 'undefined') throw new Error('Invalid Group ID');
    const response = await fetchWithAuth(`/groups/${groupId}/revoke-deputy`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return response.json();
}

const dissolveGroup = async (groupId: string, data?: { userId?: string }) => {
    if (!groupId || groupId === 'undefined') throw new Error('Invalid Group ID');
    const response = await fetchWithAuth(`/groups/${groupId}`, {
        method: 'DELETE',
        body: JSON.stringify(data || {})
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

const uploadMedia = async (file: File, folder?: string, subfolder?: string) => {
    const formData = new FormData();
    formData.append("file", file, file.name);
    if (folder) formData.append("folder", folder);
    if (subfolder) formData.append("subfolder", subfolder);

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
    const response = await fetchWithAuth(`/messages/room/${conversationId}`, {
        method: "DELETE",
    });
    return await response.json();
}

const createGroup = async (data: any) => {
    const isFormData = data instanceof FormData;
    const response = await fetchWithAuth(`/groups`, {
        method: "POST",
        body: isFormData ? data : JSON.stringify(data)
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
    data: {
        sendMessage?: string
        sendMedia?: string
        startCall?: string
        pinMessage?: string
        sendAnnouncement?: string
    }
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

const pinConversationMessage = async (conversationId: string, messageId: string) => {
    const response = await fetchWithAuth(`/conversations/${conversationId}/pin-message`, {
        method: "PUT",
        body: JSON.stringify({ messageId })
    });
    return response.json();
}

const unpinConversationMessage = async (conversationId: string) => {
    const response = await fetchWithAuth(`/conversations/${conversationId}/pin-message`, {
        method: "DELETE"
    });
    return response.json();
}

const renameGroup = async (groupId: string, name: string) => {
    const response = await fetchWithAuth(`/groups/${groupId}/rename`, {
        method: "PUT",
        body: JSON.stringify({ name })
    });
    return response.json();
}

const updateGroupAvatar = async (groupId: string, avatarData: FormData | { avatar: string }) => {
    const isFormData = avatarData instanceof FormData;
    const response = await fetchWithAuth(`/groups/${groupId}/avatar`, {
        method: "PUT",
        body: isFormData ? avatarData : JSON.stringify(avatarData)
    });
    return response.json();
}

export interface DailyConversationSummary {
    conversationId: string;
    conversationName: string;
    summary: string;
    messageCount: number;
    date: string;
    tzOffsetMinutes: number;
}

const getDailyConversationSummary = async (
    conversationId: string,
    date?: string,
    tzOffsetMinutes?: number,
): Promise<DailyConversationSummary> => {
    if (!conversationId || conversationId === 'undefined') {
        throw new Error('Invalid Conversation ID');
    }

    const query = new URLSearchParams();
    if (date) {
        query.set('date', date);
    }
    if (Number.isFinite(tzOffsetMinutes)) {
        query.set('tzOffsetMinutes', String(Math.trunc(Number(tzOffsetMinutes))));
    }

    const endpoint = `/conversations/${conversationId}/daily-summary${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetchWithAuth(endpoint);
    const payload = await response.json();
    const data = payload?.data || payload || {};

    return {
        conversationId: String(data?.conversationId || conversationId),
        conversationName: String(data?.conversationName || ''),
        summary: String(data?.summary || ''),
        messageCount: Number(data?.messageCount || 0),
        date: String(data?.date || ''),
        tzOffsetMinutes: Number(data?.tzOffsetMinutes ?? (tzOffsetMinutes ?? 0)),
    };
}

const getUserByPhone = async (phone: string): Promise<User> => {
    const response = await fetchWithAuth(`/users/phone/${phone}`);
    const data = await response.json();
    return mapUser(data);
}

const getUserById = async (userId: string): Promise<User> => {
    const response = await fetchWithAuth(`/users/id/${userId}`);
    const data = await response.json();
    return mapUser(data);
}

const getFriends = async (userId: string): Promise<User[]> => {
    if (!userId || userId === 'undefined') return [];
    const response = await fetchWithAuth(`/friends/${userId}`);
    const result = await response.json();
    return (result.data || []).map(mapUser);
}

export interface AIAskResponse {
    reply: string;
}

export interface AIHistoryItem {
    userId: string;
    chatId: string;
    conversationId?: string | null;
    question: string;
    answer: string;
    askedAt: string;
}

const askAssistant = async (question: string, conversationId?: string): Promise<AIAskResponse> => {
    const response = await fetchWithAuth(`/ai/chat`, {
        method: 'POST',
        body: JSON.stringify({ question, conversationId })
    });
    const data = await response.json();

    return {
        reply: String(data?.data?.reply || '')
    };
}

const getAssistantHistory = async (limit = 50, conversationId?: string): Promise<AIHistoryItem[]> => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (conversationId) {
        params.set('conversationId', conversationId);
    }

    const response = await fetchWithAuth(`/ai/history?${params.toString()}`);
    const data = await response.json();

    return Array.isArray(data?.data) ? data.data : [];
}

const deleteAssistantConversationHistory = async (conversationId: string): Promise<number> => {
    const response = await fetchWithAuth(`/ai/history/${conversationId}`, {
        method: 'DELETE'
    });
    const data = await response.json();
    return Number(data?.data?.deletedCount || 0);
}

export {
    getConversation,
    getMessages,
    sendMessage,
    votePoll,
    addPollOption,
    removePollOption,
    deleteMessageForMe,
    getUsers,
    deleteChatHistory,
    createGroup,
    updateParticipantSetting,
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    transferAdmin,
    appointDeputy,
    revokeDeputy,
    dissolveGroup,
    getGroupSettings,
    rotateGroupInviteCode,
    updateGroupInviteSettings,
    joinGroupByInviteCode,
    getGroupJoinRequests,
    reviewGroupJoinRequest,
    updateGroupPermissions,
    pinGroupMessage,
    unpinGroupMessage,
    pinConversationMessage,
    unpinConversationMessage,
    getDailyConversationSummary,
    getStickers,
    updateConversationBackground,
    uploadMedia,
    getLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    getUserByPhone,
    getUserById,
    getFriends,
    askAssistant,
    getAssistantHistory,
    deleteAssistantConversationHistory,
    renameGroup,
    updateGroupAvatar
}
