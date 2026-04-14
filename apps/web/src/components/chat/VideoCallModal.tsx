import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { socketService } from '@/lib/socket';

const AUDIO_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

const pickSupportedRecorderMimeType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return AUDIO_RECORDER_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
};

// Helper to convert base64 to Blob if needed for other purposes, but most logic now uses ArrayBuffer for streaming.

export default function VideoCallModal() {
  const {
    isCalling,
    callData,
    clearCall,
    localStream,
    setLocalStream,
  } = useCallStore();
  const { user } = useAuthStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);
  const isRemoteAcceptedRef = useRef(false);
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);
  const streamIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeAudioPlayersRef = useRef<Set<HTMLAudioElement>>(new Set());
  const audioObjectUrlsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);

  const targetUserId = callData?.isCaller ? callData?.toUserId : callData?.fromUserId;

  const cleanupRemoteAudioPlayers = () => {
    activeAudioPlayersRef.current.forEach((player) => {
      try {
        player.pause();
        player.src = '';
        player.load();
      } catch {
        // noop
      }
    });
    activeAudioPlayersRef.current.clear();

    audioObjectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // noop
      }
    });
    audioObjectUrlsRef.current.clear();

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {
        // noop
      });
      audioContextRef.current = null;
    }
  };


  const endCall = (notifyRemote = true) => {
    const state = useCallStore.getState();
    state.localStream?.getTracks().forEach((track) => track.stop());

    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupRemoteAudioPlayers();
    
    setLocalStream(null);

    if (notifyRemote && targetUserId) {
      socketService.getSocket()?.emit('video:end-call', {
        toUserId: targetUserId,
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
    isRemoteAcceptedRef.current = false;

    const handleCallAnswered = async (data: any) => {
      if (!mounted || !callData.isCaller) return;
      if (String(data?.toUserId || '') !== String(user.id)) return;
      setIsRemoteAccepted(true);
      isRemoteAcceptedRef.current = true;
    };

    const handleCallRejected = () => {
      alert('Nguoi dung da tu choi cuoc goi');
      endCall(false);
    };

    const handleCallEnded = () => {
      endCall(false);
    };

    const handleVideoFrame = (data: any) => {
      if (!mounted) return;
      if (String(data?.conversationId || '') !== String(callData.conversationId || '')) return;
      if (String(data?.fromUserId || '') !== String(targetUserId || '')) return;
      
      if (!isRemoteAcceptedRef.current) {
        setIsRemoteAccepted(true);
        isRemoteAcceptedRef.current = true;
      }
      if (data.frame) {
         setRemoteFrame(data.frame);
      }
    };

    const handleAudioFrame = (data: any) => {
      if (!mounted) return;
      if (String(data?.conversationId || '') !== String(callData.conversationId || '')) return;
      if (String(data?.fromUserId || '') !== String(targetUserId || '')) return;

      if (data.audio) {
        if (!isRemoteAcceptedRef.current) {
          setIsRemoteAccepted(true);
          isRemoteAcceptedRef.current = true;
        }

        try {
          const payload = String(data.audio);
          let base64Data = payload;
          if (payload.startsWith('data:')) {
            const commaIndex = payload.indexOf(',');
            if (commaIndex > 0) base64Data = payload.slice(commaIndex + 1);
          }

          const mimeType = typeof data?.audioMimeType === 'string' ? data.audioMimeType : 'audio/webm';
          
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mimeType });
          
          const objectUrl = URL.createObjectURL(blob);
          audioObjectUrlsRef.current.add(objectUrl);

          const player = new Audio(objectUrl);
          player.autoplay = true;
          player.volume = 1;

          activeAudioPlayersRef.current.add(player);

          const cleanup = () => {
            activeAudioPlayersRef.current.delete(player);
            if (audioObjectUrlsRef.current.has(objectUrl)) {
              audioObjectUrlsRef.current.delete(objectUrl);
              URL.revokeObjectURL(objectUrl);
            }
          };

          player.onended = cleanup;
          player.onerror = cleanup;
          
          player.play().catch(e => {
            console.warn('[WEB] Playback failed for chunk:', e);
            cleanup();
          });
        } catch (err) {
          console.warn('[WEB] handleAudioFrame failed:', err);
        }
      }
    };

    const socket = socketService.getSocket();
    // Bind listeners before any emit to avoid missing fast "answered" responses.
    socket?.on('video:call-answered', handleCallAnswered);
    socket?.on('video:call-rejected', handleCallRejected);
    socket?.on('video:call-ended', handleCallEnded);
    socket?.on('video:frame', handleVideoFrame);
    socket?.on('video:audio-frame', handleAudioFrame);

    const initFakeWebRtc = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: callData.callType === 'video',
          audio: true,
        });
      } catch (err: any) {
        console.error('Failed to get camera/mic:', err);
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
        return;
      }

      if (!mounted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      try {
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 1. Send signal
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
          isRemoteAcceptedRef.current = true;
        }

        // 2. Start fake video stream
        if (callData.callType === 'video') {
            streamIntervalRef.current = setInterval(() => {
                if (!localVideoRef.current || !canvasRef.current || !socket || !targetUserId) return;
                const canvas = canvasRef.current;
                const video = localVideoRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && video.videoWidth > 0 && isRemoteAcceptedRef.current) {
                    canvas.width = 360; 
                    canvas.height = (video.videoHeight / video.videoWidth) * 360;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const frame = canvas.toDataURL('image/jpeg', 0.3); // low quality 
                    socket.emit('video:frame', {
                       toUserId: targetUserId,
                       fromUserId: user.id,
                       conversationId: callData.conversationId,
                       frame
                    });
                }
            }, 400); // ~2.5 FPS for stability
        }

        // 3. Start real-time audio chunking (optional, do not fail whole call if codec unsupported)
        try {
          const audioTracks = stream.getAudioTracks();
          if (!audioTracks.length) {
            console.warn('[WEB] No audio track available to record');
            return;
          }

          const audioOnlyStream = new MediaStream(audioTracks);
          const preferredMimeType = pickSupportedRecorderMimeType();
          const recorder = preferredMimeType
            ? new MediaRecorder(audioOnlyStream, { mimeType: preferredMimeType })
            : new MediaRecorder(audioOnlyStream);

          mediaRecorderRef.current = recorder;
          
          recorder.ondataavailable = async (event) => {
            if (event.data.size > 0 && socket && targetUserId && isRemoteAcceptedRef.current) {
              const chunkMimeType = event.data.type || recorder.mimeType || preferredMimeType || '';
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64Audio = reader.result as string;
                socket.emit('video:audio-frame', {
                  toUserId: targetUserId,
                  fromUserId: user.id,
                  conversationId: callData.conversationId,
                  audio: base64Audio,
                  audioMimeType: chunkMimeType,
                });
              };
              reader.readAsDataURL(event.data);
            }
          };

          const runStandaloneCycle = () => {
            if (!mounted || !isRemoteAcceptedRef.current) {
               if (mounted) setTimeout(runStandaloneCycle, 1000);
               return;
            }
            
            try {
              if (recorder.state === 'inactive') {
                recorder.start();
                // Record for 1.5 seconds per chunk
                setTimeout(() => {
                  if (recorder.state === 'recording') {
                    recorder.stop();
                  }
                }, 1500);
              }
            } catch (e) {
              console.warn('[WEB] Recorder cycle error:', e);
            }
          };

          recorder.onstop = () => {
             if (mounted) {
                // Small gap to prevent overlapping starts
                setTimeout(runStandaloneCycle, 100);
             }
          };

          runStandaloneCycle();
        } catch (audioErr) {
          console.warn('[WEB] MediaRecorder unavailable, continue call without audio chunk relay:', audioErr);
        }

      } catch (err) {
        console.error('Failed to initialize call pipeline:', err);
        endCall(false);
      }
    };

    initFakeWebRtc();

    return () => {
      mounted = false;
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      cleanupRemoteAudioPlayers();
      socket?.off('video:call-answered', handleCallAnswered);
      socket?.off('video:call-rejected', handleCallRejected);
      socket?.off('video:call-ended', handleCallEnded);
      socket?.off('video:frame', handleVideoFrame);
      socket?.off('video:audio-frame', handleAudioFrame);
    };
  }, [isCalling, callData, user?.id, user?.fullName, user?.avatarUrl, clearCall, setLocalStream]);

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
      <canvas ref={canvasRef} className="hidden" />
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
          </div>
        ) : remoteFrame ? (
          <img src={remoteFrame} className="w-full h-full object-cover" alt="Remote Video Frame" />
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
           {isRemoteAccepted ? 'Dau ben kia da nhan cuoc goi (Fake Video Call)' : 'Dang cho may...'}
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
