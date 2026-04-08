import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { socketService } from '@/lib/socket';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function VideoCallModal() {
  const {
    isCalling,
    callData,
    clearCall,
    localStream,
    setLocalStream,
    setRemoteStream,
    remoteStream,
  } = useCallStore();
  const { user } = useAuthStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);

  const teardownPeer = () => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
  };

  const endCall = (notifyRemote = true) => {
    const state = useCallStore.getState();
    state.localStream?.getTracks().forEach((track) => track.stop());

    teardownPeer();
    setLocalStream(null);
    setRemoteStream(null);

    if (notifyRemote) {
      socketService.getSocket()?.emit('video:end-call', {
        toUserId: callData?.isCaller ? callData?.toUserId : callData?.fromUserId,
        fromUserId: user?.id,
        conversationId: callData?.conversationId,
      });
    }

    clearCall();
  };

  useEffect(() => {
    if (!isCalling || !callData || !user) return;

    let mounted = true;
    setIsRemoteAccepted(false);

    const targetUserId = callData.isCaller ? callData.toUserId : callData.fromUserId;

    const safeAddIceCandidate = async (candidate: RTCIceCandidateInit) => {
      const pc = pcRef.current;
      if (!pc) return;

      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add ICE candidate:', err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const flushPendingCandidates = async () => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) return;

      const pending = [...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];

      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to flush ICE candidate:', err);
        }
      }
    };

    const sendSignal = (signal: any) => {
      if (!targetUserId) return;
      socketService.getSocket()?.emit('video:signal', {
        toUserId: targetUserId,
        conversationId: callData.conversationId,
        signal,
      });
    };

    const handleCallAnswered = async (data: any) => {
      if (!mounted || !callData.isCaller) return;
      if (String(data?.toUserId || '') !== String(user.id)) return;
      setIsRemoteAccepted(true);

      const pc = pcRef.current;
      if (!pc || pc.signalingState !== 'stable') return;

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callData.callType === 'video',
        });
        await pc.setLocalDescription(offer);
        sendSignal({ type: 'offer', sdp: offer.sdp });
      } catch (err) {
        console.error('Failed to create offer:', err);
      }
    };

    const handleSignal = async (data: any) => {
      if (!mounted) return;
      if (String(data?.conversationId || '') !== String(callData.conversationId || '')) return;
      if (String(data?.fromUserId || '') !== String(targetUserId || '')) return;

      const signal = data?.signal;
      const pc = pcRef.current;
      if (!pc || !signal?.type) return;

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          setIsRemoteAccepted(true);
          await flushPendingCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: 'answer', sdp: answer.sdp });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
          setIsRemoteAccepted(true);
          await flushPendingCandidates();
        } else if (signal.type === 'ice-candidate' && signal.candidate) {
          await safeAddIceCandidate(signal.candidate);
        }
      } catch (err) {
        console.error('Failed to handle signal:', err);
      }
    };

    const handleCallRejected = () => {
      alert('Nguoi dung da tu choi cuoc goi');
      endCall(false);
    };

    const handleCallEnded = () => {
      endCall(false);
    };

    const initWebRtc = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callData.callType === 'video',
          audio: true,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          sendSignal({ type: 'ice-candidate', candidate: event.candidate.toJSON() });
        };

        pc.ontrack = (event) => {
          const [remote] = event.streams;
          if (remote) {
            setRemoteStream(remote);
            setIsRemoteAccepted(true);
          }
        };

        const socket = socketService.getSocket();

        if (callData.isCaller) {
          socket?.emit('video:call-user', {
            fromUserId: user.id,
            toUserId: callData.toUserId,
            conversationId: callData.conversationId,
            callerName: user.fullName,
            callerAvatar: user.avatarUrl,
            callType: callData.callType,
          });
        } else {
          socket?.emit('video:answer-call', {
            toUserId: callData.fromUserId,
            fromUserId: user.id,
            conversationId: callData.conversationId,
          });
          setIsRemoteAccepted(true);
        }

        socket?.on('video:call-answered', handleCallAnswered);
        socket?.on('video:signal', handleSignal);
        socket?.on('video:call-rejected', handleCallRejected);
        socket?.on('video:call-ended', handleCallEnded);
      } catch (err) {
        console.error('Failed to get camera/mic:', err);
        alert('Hay cap quyen Camera va Microphone de goi video.');
        endCall(false);
      }
    };

    initWebRtc();

    return () => {
      mounted = false;
      const socket = socketService.getSocket();
      socket?.off('video:call-answered', handleCallAnswered);
      socket?.off('video:signal', handleSignal);
      socket?.off('video:call-rejected', handleCallRejected);
      socket?.off('video:call-ended', handleCallEnded);
      teardownPeer();
    };
  }, [isCalling, callData, user?.id, user?.fullName, user?.avatarUrl, clearCall, setLocalStream, setRemoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = isVideoOff;
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  if (!isCalling || !callData) return null;

  const isAudioCall = callData.callType === 'audio';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black animate-in fade-in duration-300">
      <div className="absolute inset-0 w-full h-full">
        {isAudioCall ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 border-none">
            {remoteStream && <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />}
            <div className="relative w-40 h-40">
              {callData?.callerAvatar ? (
                <img src={callData.callerAvatar} alt="avatar" className="w-full h-full rounded-full object-cover shadow-2xl border-4 border-primary-500 z-10 relative" />
              ) : (
                <div className="w-full h-full flex items-center justify-center rounded-full bg-primary-100 text-6xl text-primary-600 font-bold border-4 border-primary-500 z-10 relative">
                  {callData?.callerName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="absolute inset-0 rounded-full border border-primary-500 animate-[ping_2s_ease-in-out_infinite]"></div>
              <div className="absolute inset-0 rounded-full border border-primary-500 animate-[ping_2.5s_ease-in-out_infinite]" style={{ animationDelay: '0.5s' }}></div>
            </div>
          </div>
        ) : remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
            <div className={`w-24 h-24 rounded-full border-4 border-primary-500 mb-6 ${isRemoteAccepted ? 'border-t-primary-500' : 'border-t-transparent animate-spin'}`}></div>
            <p className="text-white text-xl animate-pulse">
              {isRemoteAccepted ? 'Dau ben kia da nhan cuoc goi' : 'Dang ket noi...'}
            </p>
          </div>
        )}
      </div>

      {!isAudioCall && (
        <div className="absolute top-6 right-6 w-32 h-48 sm:w-48 sm:h-72 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-10 transition-transform hover:scale-105">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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
          {remoteStream
            ? (isAudioCall ? 'Dang goi thoai...' : 'Da ket noi')
            : (isRemoteAccepted ? 'Dau ben kia da nhan cuoc goi' : 'Dang cho may...')}
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
