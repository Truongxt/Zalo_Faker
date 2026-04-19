import { create } from 'zustand';

export interface CallData {
    isCaller: boolean;
    toUserId?: string; // Nếu mình là người gọi
    fromUserId?: string; // Nếu mình là người nhận
    conversationId?: string;
    callerName?: string;
    callerAvatar?: string;
    callType: 'audio' | 'video';
    isGroupCall?: boolean;
}

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
}

export const useCallStore = create<CallState>((set) => ({
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
    }
}));
