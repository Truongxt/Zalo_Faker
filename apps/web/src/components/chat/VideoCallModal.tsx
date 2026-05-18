import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { socketService } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';

const parseIceServers = (): RTCIceServer[] => {
  const rawJson = String(import.meta.env.VITE_ICE_SERVERS || '').trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as RTCIceServer[];
      }
    } catch (error) {
      console.warn('[WEB WebRTC] VITE_ICE_SERVERS is invalid JSON:', error);
    }
  }

  const turnUrl = String(import.meta.env.VITE_TURN_URL || '').trim();
  const turnUsername = String(import.meta.env.VITE_TURN_USERNAME || '').trim();
  const turnCredential = String(import.meta.env.VITE_TURN_CREDENTIAL || '').trim();

  const defaultServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  if (turnUrl) {
    defaultServers.push({
      urls: turnUrl,
      username: turnUsername || undefined,
      credential: turnCredential || undefined,
    });
  }

  return defaultServers;
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: parseIceServers(),
  iceCandidatePoolSize: 4,
};

export default function VideoCallModal() {
  const {
    isCalling,
    callData,
    clearCall,
    localStream,
    remoteStream,
    setLocalStream,
    setRemoteStream,
  } = useCallStore();
  const { user } = useAuthStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const acceptedAtRef = useRef<number | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);

  const targetUserId = callData?.isCaller ? callData?.toUserId : callData?.fromUserId;
  const isAudioCall = callData?.callType === 'audio';

  useEffect(() => {
    localStreamRef.current = localStream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const markAccepted = useCallback(() => {
    if (!acceptedAtRef.current) {
      acceptedAtRef.current = Date.now();
    }
    setIsRemoteAccepted(true);
  }, []);

  const getCallDurationSeconds = useCallback(() => {
    if (!acceptedAtRef.current) return 0;
    return Math.max(0, Math.floor((Date.now() - acceptedAtRef.current) / 1000));
  }, []);

  const emitSignal = useCallback(
    (eventName: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice-candidate', payload: Record<string, unknown>) => {
      if (!targetUserId) return;
      socketService.getSocket()?.emit(eventName, {
        toUserId: targetUserId,
        roomId: callData?.conversationId,
        ...payload,
      });
    },
    [callData?.conversationId, targetUserId],
  );

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
        markAccepted();
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitSignal('webrtc:ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        markAccepted();
      }
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        markAccepted();
      }
    };

    return pc;
  }, [emitSignal, markAccepted, setRemoteStream]);

  const createAndSendOffer = useCallback(async () => {
    if (!targetUserId) return;
    const pc = createPeerConnection();

    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      emitSignal('webrtc:offer', {
        offer: pc.localDescription,
      });
    } catch (err) {
      console.error('[WEB WebRTC] create offer failed:', err);
    } finally {
      makingOfferRef.current = false;
    }
  }, [createPeerConnection, emitSignal, targetUserId]);

  const handleOffer = useCallback(
    async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
      if (!targetUserId || String(fromUserId) !== String(targetUserId)) return;
      const pc = createPeerConnection();

      const isPolite = String(user?.id || '') < String(fromUserId);
      const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';
      ignoreOfferRef.current = !isPolite && offerCollision;
      if (ignoreOfferRef.current) return;

      try {
        if (offerCollision) {
          await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        for (const candidate of pendingCandidatesRef.current.splice(0)) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitSignal('webrtc:answer', {
          answer: pc.localDescription,
        });
        markAccepted();
      } catch (err) {
        console.error('[WEB WebRTC] handle offer failed:', err);
      }
    },
    [createPeerConnection, emitSignal, markAccepted, targetUserId, user?.id],
  );

  const handleAnswer = useCallback(
    async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
      if (!targetUserId || String(fromUserId) !== String(targetUserId)) return;
      const pc = pcRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        for (const candidate of pendingCandidatesRef.current.splice(0)) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        markAccepted();
      } catch (err) {
        console.error('[WEB WebRTC] handle answer failed:', err);
      }
    },
    [markAccepted, targetUserId],
  );

  const handleIceCandidate = useCallback(
    async (fromUserId: string, candidate: RTCIceCandidateInit) => {
      if (!targetUserId || String(fromUserId) !== String(targetUserId)) return;
      const pc = pcRef.current || createPeerConnection();

      if (!pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (!ignoreOfferRef.current) {
          console.warn('[WEB WebRTC] add ICE candidate failed:', err);
        }
      }
    },
    [createPeerConnection, targetUserId],
  );

  const endCall = useCallback(
    (notifyRemote = true) => {
      pcRef.current?.close();
      pcRef.current = null;
      pendingCandidatesRef.current = [];

      useCallStore.getState().localStream?.getTracks().forEach((track) => track.stop());
      useCallStore.getState().remoteStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
      setRemoteStream(null);

      if (notifyRemote && targetUserId) {
        socketService.getSocket()?.emit('video:end-call', {
          toUserId: targetUserId,
          fromUserId: user?.id,
          conversationId: callData?.conversationId,
          callType: callData?.callType || 'audio',
          isGroupCall: false,
          status: acceptedAtRef.current ? 'finished' : callData?.isCaller ? 'cancelled' : 'finished',
          duration: getCallDurationSeconds(),
        });
      }

      acceptedAtRef.current = null;
      clearCall();
    },
    [
      callData?.callType,
      callData?.conversationId,
      callData?.isCaller,
      clearCall,
      getCallDurationSeconds,
      setLocalStream,
      setRemoteStream,
      targetUserId,
      user?.id,
    ],
  );

  useEffect(() => {
    if (!isCalling || !callData || !user || !targetUserId) return;

    let mounted = true;
    acceptedAtRef.current = null;
    setIsRemoteAccepted(false);

    const socket = socketService.getSocket();

    const handleCallAnswered = async (data: any) => {
      if (!mounted || !callData.isCaller) return;
      if (String(data?.toUserId || '') !== String(user.id)) return;
      if (String(data?.conversationId || '') !== String(callData.conversationId || '')) return;
      markAccepted();
      await createAndSendOffer();
    };

    const handleCallRejected = (data: any) => {
      if (data?.conversationId && String(data.conversationId) !== String(callData.conversationId || '')) return;
      alert('Nguoi dung da tu choi cuoc goi');
      endCall(false);
    };

    const handleCallEnded = (data: any) => {
      if (data?.conversationId && String(data.conversationId) !== String(callData.conversationId || '')) return;
      endCall(false);
    };

    const handleWebRTCOffer = (data: any) => {
      handleOffer(String(data?.fromUserId || ''), data?.offer);
    };

    const handleWebRTCAnswer = (data: any) => {
      handleAnswer(String(data?.fromUserId || ''), data?.answer);
    };

    const handleWebRTCIce = (data: any) => {
      handleIceCandidate(String(data?.fromUserId || ''), data?.candidate);
    };

    socket?.on('video:call-answered', handleCallAnswered);
    socket?.on('video:call-rejected', handleCallRejected);
    socket?.on('video:call-ended', handleCallEnded);
    socket?.on('webrtc:offer', handleWebRTCOffer);
    socket?.on('webrtc:answer', handleWebRTCAnswer);
    socket?.on('webrtc:ice-candidate', handleWebRTCIce);

    const initWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callData.callType === 'video',
          audio: true,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        if (callData.isCaller) {
          socket?.emit('video:call-user', {
            fromUserId: user.id,
            toUserId: callData.toUserId,
            conversationId: callData.conversationId,
            callerName: user.fullName,
            callerAvatar: user.avatarUrl,
            callType: callData.callType,
            isGroupCall: false,
          });
        } else {
          socket?.emit('video:answer-call', {
            toUserId: callData.fromUserId,
            fromUserId: user.id,
            conversationId: callData.conversationId,
            isGroupCall: false,
          });
          markAccepted();
        }
      } catch (err: any) {
        console.error('[WEB WebRTC] Failed to get camera/mic:', err);
        const name = String(err?.name || '');
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          alert('Trinh duyet dang chan Camera/Microphone. Hay cap quyen roi thu lai.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          alert('Khong tim thay thiet bi Camera/Microphone phu hop.');
        } else if (name === 'NotReadableError') {
          alert('Camera/Microphone dang duoc ung dung khac su dung.');
        } else {
          alert('Khong the truy cap Camera/Microphone. Vui long thu lai.');
        }
        endCall(false);
      }
    };

    initWebRTC();

    return () => {
      mounted = false;
      socket?.off('video:call-answered', handleCallAnswered);
      socket?.off('video:call-rejected', handleCallRejected);
      socket?.off('video:call-ended', handleCallEnded);
      socket?.off('webrtc:offer', handleWebRTCOffer);
      socket?.off('webrtc:answer', handleWebRTCAnswer);
      socket?.off('webrtc:ice-candidate', handleWebRTCIce);
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [
    callData,
    clearCall,
    createAndSendOffer,
    endCall,
    handleAnswer,
    handleIceCandidate,
    handleOffer,
    isCalling,
    markAccepted,
    setLocalStream,
    targetUserId,
    user,
  ]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextVideoOff;
    });
    setIsVideoOff(nextVideoOff);
  };

  if (!isCalling || !callData) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black animate-in fade-in duration-300">
      <div className="absolute inset-0 w-full h-full">
        {isAudioCall ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 border-none">
            <div className="relative w-40 h-40">
              {callData?.callerAvatar ? (
                <img src={callData.callerAvatar} alt="avatar" className="w-full h-full rounded-full object-cover shadow-2xl border-4 border-primary-500 z-10 relative" />
              ) : (
                <div className="w-full h-full flex items-center justify-center rounded-full bg-primary-100 text-6xl text-primary-600 font-bold border-4 border-primary-500 z-10 relative">
                  {callData?.callerName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          </div>
        ) : remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-gray-900" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
            <div className={`w-24 h-24 rounded-full border-4 border-primary-500 mb-6 ${isRemoteAccepted ? 'border-t-primary-500' : 'border-t-transparent animate-spin'}`}></div>
            <p className="text-white text-xl animate-pulse">
              {isRemoteAccepted ? 'Dang thiet lap WebRTC...' : 'Dang ket noi...'}
            </p>
          </div>
        )}
      </div>

      {!isAudioCall && (
        <div className="absolute top-6 right-6 w-32 h-48 sm:w-48 sm:h-72 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-10 transition-transform hover:scale-105">
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
          {(isMuted || isVideoOff) && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
              {isVideoOff && <VideoOff className="w-6 h-6 text-white" />}
              {isMuted && <MicOff className="w-6 h-6 text-white" />}
            </div>
          )}
        </div>
      )}

      <div className="absolute top-8 left-8 z-10">
        <h2 className="text-white text-2xl font-bold shadow-black drop-shadow-lg">
          {callData?.callerName || (isAudioCall ? 'Cuoc goi thoai' : 'Cuoc goi video')}
        </h2>
        <p className="text-white/80 mt-1 shadow-black drop-shadow-md">
          {remoteStream ? 'Da ket noi WebRTC' : isRemoteAccepted ? 'Dau ben kia da nhan cuoc goi' : 'Dang cho may...'}
        </p>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-gray-900/80 backdrop-blur-md rounded-full border border-white/10 shadow-2xl z-20 transition-all">
        <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'}`}>
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-lg shadow-red-500/50 mx-2">
          <PhoneOff className="w-8 h-8" />
        </button>
        {!isAudioCall && (
          <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
}
