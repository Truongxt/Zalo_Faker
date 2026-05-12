import { create } from 'zustand';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export interface CallData {
    isCaller: boolean;
    toUserId?: string;
    fromUserId?: string;
    conversationId?: string;
    callerName?: string;
    callerAvatar?: string;
    callType: 'audio' | 'video';
    isGroupCall?: boolean;
}

export interface ParticipantInfo {
    userId: string;
    socketId?: string;
    name?: string;
    avatar?: string;
    isMuted: boolean;
    isVideoOff: boolean;
    joinedAt?: string;
}

export type GroupCallStatus = 'idle' | 'joining' | 'connected' | 'in-call' | 'left';

export interface GroupCallState {
    roomId: string | null;
    conversationId: string | null;
    callType: 'audio' | 'video';
    callStatus: GroupCallStatus;
    participants: Record<string, ParticipantInfo>;
    isHost: boolean;
    hostUserId: string | null;
    activeSpeaker: string | null;
    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>;
    screenStream: MediaStream | null;
    isScreenSharing: boolean;
    isMuted: boolean;
    isVideoOff: boolean;
}

// ─────────────────────────────────────────────────
// 1-1 Call State (legacy, unchanged)
// ─────────────────────────────────────────────────

interface CallState {
    isReceivingCall: boolean;
    isCalling: boolean;
    callData: CallData | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    
    setIncomingCall: (data: CallData) => void;
    setOutgoingCall: (data: CallData) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setRemoteStream: (stream: MediaStream | null) => void;
    clearCall: () => void;

    // ─────────────────────────────────────────────
    // Group Call State
    // ─────────────────────────────────────────────
    groupCall: GroupCallState;
    
    // Group Call Incoming
    incomingGroupCall: {
        roomId: string;
        conversationId: string;
        callType: 'audio' | 'video';
        callerName: string;
        callerAvatar: string | null;
        hostUserId: string;
        participantCount: number;
    } | null;
    setIncomingGroupCall: (data: CallState['incomingGroupCall']) => void;
    clearIncomingGroupCall: () => void;

    // Group Call Actions
    startGroupCall: (roomId: string, conversationId: string, callType: 'audio' | 'video', isHost: boolean, hostUserId: string) => void;
    setGroupCallStatus: (status: GroupCallStatus) => void;
    addGroupParticipant: (participant: ParticipantInfo) => void;
    removeGroupParticipant: (userId: string) => void;
    updateGroupParticipantMedia: (userId: string, updates: Partial<Pick<ParticipantInfo, 'isMuted' | 'isVideoOff'>>) => void;
    setGroupLocalStream: (stream: MediaStream | null) => void;
    addGroupRemoteStream: (userId: string, stream: MediaStream) => void;
    removeGroupRemoteStream: (userId: string) => void;
    setGroupActiveSpeaker: (userId: string | null) => void;
    setGroupMuted: (isMuted: boolean) => void;
    setGroupVideoOff: (isVideoOff: boolean) => void;
    setGroupScreenSharing: (isScreenSharing: boolean, stream: MediaStream | null) => void;
    setGroupHost: (hostUserId: string) => void;
    clearGroupCall: () => void;
}

// ─────────────────────────────────────────────────
// Initial group call state
// ─────────────────────────────────────────────────

const initialGroupCall: GroupCallState = {
    roomId: null,
    conversationId: null,
    callType: 'audio',
    callStatus: 'idle',
    participants: {},
    isHost: false,
    hostUserId: null,
    activeSpeaker: null,
    localStream: null,
    remoteStreams: {},
    screenStream: null,
    isScreenSharing: false,
    isMuted: false,
    isVideoOff: false,
};

// ─────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────

export const useCallStore = create<CallState>((set) => ({
    // 1-1 Call State (unchanged)
    isReceivingCall: false,
    isCalling: false,
    callData: null,
    localStream: null,
    remoteStream: null,

    setIncomingCall: (data) => set({ isReceivingCall: true, callData: data }),
    setOutgoingCall: (data) => set({ isCalling: true, isReceivingCall: false, callData: data }),
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),
    
    clearCall: () => {
        set((state) => {
            if (state.localStream) {
                state.localStream.getTracks().forEach(track => track.stop());
            }
            if (state.remoteStream) {
                state.remoteStream.getTracks().forEach(track => track.stop());
            }
            return {
                isReceivingCall: false,
                isCalling: false,
                callData: null,
                localStream: null,
                remoteStream: null,
            };
        });
    },

    // ─────────────────────────────────────────────
    // Group Call State
    // ─────────────────────────────────────────────
    groupCall: { ...initialGroupCall },
    incomingGroupCall: null,

    setIncomingGroupCall: (data) => set({ incomingGroupCall: data }),
    clearIncomingGroupCall: () => set({ incomingGroupCall: null }),

    startGroupCall: (roomId, conversationId, callType, isHost, hostUserId) => set({
        groupCall: {
            ...initialGroupCall,
            roomId,
            conversationId,
            callType,
            callStatus: 'joining',
            isHost,
            hostUserId,
        },
    }),

    setGroupCallStatus: (status) => set((state) => ({
        groupCall: { ...state.groupCall, callStatus: status },
    })),

    addGroupParticipant: (participant) => set((state) => ({
        groupCall: {
            ...state.groupCall,
            participants: {
                ...state.groupCall.participants,
                [participant.userId]: participant,
            },
        },
    })),

    removeGroupParticipant: (userId) => set((state) => {
        const { [userId]: _, ...rest } = state.groupCall.participants;
        return {
            groupCall: { ...state.groupCall, participants: rest },
        };
    }),

    updateGroupParticipantMedia: (userId, updates) => set((state) => {
        const existing = state.groupCall.participants[userId];
        if (!existing) return state;
        return {
            groupCall: {
                ...state.groupCall,
                participants: {
                    ...state.groupCall.participants,
                    [userId]: { ...existing, ...updates },
                },
            },
        };
    }),

    setGroupLocalStream: (stream) => set((state) => ({
        groupCall: { ...state.groupCall, localStream: stream },
    })),

    addGroupRemoteStream: (userId, stream) => set((state) => ({
        groupCall: {
            ...state.groupCall,
            remoteStreams: { ...state.groupCall.remoteStreams, [userId]: stream },
        },
    })),

    removeGroupRemoteStream: (userId) => set((state) => {
        const { [userId]: removed, ...rest } = state.groupCall.remoteStreams;
        if (removed) {
            removed.getTracks().forEach((t) => t.stop());
        }
        return {
            groupCall: { ...state.groupCall, remoteStreams: rest },
        };
    }),

    setGroupActiveSpeaker: (userId) => set((state) => ({
        groupCall: { ...state.groupCall, activeSpeaker: userId },
    })),

    setGroupMuted: (isMuted) => set((state) => ({
        groupCall: { ...state.groupCall, isMuted },
    })),

    setGroupVideoOff: (isVideoOff) => set((state) => ({
        groupCall: { ...state.groupCall, isVideoOff },
    })),

    setGroupScreenSharing: (isScreenSharing, stream) => set((state) => ({
        groupCall: { ...state.groupCall, isScreenSharing, screenStream: stream },
    })),

    setGroupHost: (hostUserId) => set((state) => ({
        groupCall: {
            ...state.groupCall,
            hostUserId,
            isHost: hostUserId === state.groupCall.hostUserId,
        },
    })),

    clearGroupCall: () => set((state) => {
        // Cleanup all media
        if (state.groupCall.localStream) {
            state.groupCall.localStream.getTracks().forEach((t) => t.stop());
        }
        if (state.groupCall.screenStream) {
            state.groupCall.screenStream.getTracks().forEach((t) => t.stop());
        }
        Object.values(state.groupCall.remoteStreams).forEach((stream) => {
            stream.getTracks().forEach((t) => t.stop());
        });
        return {
            groupCall: { ...initialGroupCall },
            incomingGroupCall: null,
        };
    }),
}));
