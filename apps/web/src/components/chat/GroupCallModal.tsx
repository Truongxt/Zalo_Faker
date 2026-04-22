import { useEffect, useRef, useState, useCallback } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { socketService } from '@/lib/socket';
import { WebRTCMeshManager } from '@/lib/webrtcManager';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Users,
  Crown,
  X,
  UserMinus,
  LogIn,
  LogOut,
} from 'lucide-react';

// ─────────────────────────────────────────────────
// Grid layout helper
// ─────────────────────────────────────────────────

const getGridClass = (count: number): string => {
  if (count <= 1) return 'grid-cols-1 grid-rows-1';
  if (count === 2) return 'grid-cols-2 grid-rows-1';
  if (count <= 4) return 'grid-cols-2 grid-rows-2';
  if (count <= 6) return 'grid-cols-3 grid-rows-2';
  return 'grid-cols-3 grid-rows-3';
};

const mergeFloat32Chunks = (chunks: Float32Array[]): Float32Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
};

const audioBufferToWavBlob = (pcmData: Float32Array, sampleRate: number): Blob => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let writeOffset = 44;
  for (let i = 0; i < pcmData.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, pcmData[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(writeOffset, intSample, true);
    writeOffset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// ─────────────────────────────────────────────────
// Video Tile Component
// ─────────────────────────────────────────────────

function VideoTile({
  stream,
  frame,
  label,
  isMuted,
  isVideoOff,
  isActiveSpeaker,
  isLocal,
  avatar,
}: {
  stream: MediaStream | null;
  frame?: string | null;
  label: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isActiveSpeaker: boolean;
  isLocal?: boolean;
  avatar?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  const showVideo = stream && !isVideoOff;
  const showFrame = !showVideo && frame;

  return (
    <div
      className={`relative w-full h-full bg-gray-800 rounded-xl overflow-hidden transition-all duration-300 ${
        isActiveSpeaker
          ? 'ring-3 ring-green-400 shadow-lg shadow-green-400/20'
          : 'ring-1 ring-white/10'
      }`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : showFrame ? (
        <img
          src={frame}
          alt={label}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
          {avatar ? (
            <img
              src={avatar}
              alt={label}
              className="w-20 h-20 rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-500/30 flex items-center justify-center text-3xl font-bold text-white">
              {label.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Status indicators */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        {isMuted && (
          <div className="w-7 h-7 rounded-full bg-red-500/80 backdrop-blur-sm flex items-center justify-center">
            <MicOff className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {isVideoOff && (
          <div className="w-7 h-7 rounded-full bg-red-500/80 backdrop-blur-sm flex items-center justify-center">
            <VideoOff className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Active speaker pulse */}
      {isActiveSpeaker && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 rounded-xl border-2 border-green-400 animate-pulse opacity-60" />
        </div>
      )}

      {/* Name label */}
      <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm">
        <span className="text-white text-sm font-medium">
          {isLocal ? 'Bạn' : label}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────

export default function GroupCallModal() {
  const { user } = useAuthStore();
  const {
    groupCall,
    addGroupParticipant,
    removeGroupParticipant,
    updateGroupParticipantMedia,
    setGroupCallStatus,
    setGroupActiveSpeaker,
    setGroupHost,
    clearGroupCall,
  } = useCallStore();

  const meshRef = useRef<WebRTCMeshManager | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callStartedAt = useRef<number | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toast notifications for join/leave
  const [notifications, setNotifications] = useState<
    { id: string; name: string; type: 'join' | 'leave' }[]
  >([]);
  const notifIdRef = useRef(0);

  const pushNotification = useCallback((name: string, type: 'join' | 'leave') => {
    const id = `notif-${++notifIdRef.current}`;
    setNotifications((prev) => [...prev, { id, name, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3500);
  }, []);

  const [remoteFrames, setRemoteFrames] = useState<Record<string, string>>({});
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  const {
    roomId,
    conversationId,
    callStatus,
    callType,
    participants,
    localStream,
    remoteStreams,
    isHost,
    hostUserId,
    activeSpeaker,
    isMuted,
    isVideoOff,
    isScreenSharing,
  } = groupCall;

  const isActive = callStatus !== 'idle' && callStatus !== 'left' && roomId !== null;

  // ───────────── Call Duration Timer ─────────────

  useEffect(() => {
    if (callStatus === 'in-call' && !callStartedAt.current) {
      callStartedAt.current = Date.now();
      durationInterval.current = setInterval(() => {
        if (callStartedAt.current) {
          setCallDuration(Math.floor((Date.now() - callStartedAt.current) / 1000));
        }
      }, 1000);
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [callStatus]);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ───────────── Socket Event Handlers ─────────────

  const handleWebRTCOffer = useCallback(
    async (data: { fromUserId: string; offer: RTCSessionDescriptionInit; roomId: string }) => {
      if (!meshRef.current || data.roomId !== roomId) return;
      await meshRef.current.handleOffer(data.fromUserId, data.offer);
    },
    [roomId],
  );

  const handleWebRTCAnswer = useCallback(
    async (data: { fromUserId: string; answer: RTCSessionDescriptionInit; roomId: string }) => {
      if (!meshRef.current || data.roomId !== roomId) return;
      await meshRef.current.handleAnswer(data.fromUserId, data.answer);
    },
    [roomId],
  );

  const handleICECandidate = useCallback(
    async (data: { fromUserId: string; candidate: RTCIceCandidateInit; roomId: string }) => {
      if (!meshRef.current || data.roomId !== roomId) return;
      await meshRef.current.handleIceCandidate(data.fromUserId, data.candidate);
    },
    [roomId],
  );

  const handleUserJoined = useCallback(
    async (data: { roomId: string; userId: string; userName: string; userAvatar: string | null }) => {
      if (data.roomId !== roomId || !meshRef.current) return;

      addGroupParticipant({
        userId: data.userId,
        name: data.userName,
        avatar: data.userAvatar || undefined,
        isMuted: false,
        isVideoOff: false,
      });

      // Someone joined → we are now in an active call
      setGroupCallStatus('in-call');

      // Show toast notification
      pushNotification(data.userName || 'Người dùng', 'join');

      // Create peer connection with the new user (we send offer)
      await meshRef.current.createPeerConnection(data.userId, true);
    },
    [roomId, addGroupParticipant, setGroupCallStatus, pushNotification],
  );

  const handleUserLeft = useCallback(
    (data: { roomId: string; userId: string; newHostUserId?: string }) => {
      if (data.roomId !== roomId) return;

      // Get participant name before removing
      const leavingParticipant = participants[data.userId];
      const leavingName = leavingParticipant?.name || 'Người dùng';

      removeGroupParticipant(data.userId);
      meshRef.current?.closePeer(data.userId);

      if (data.newHostUserId) {
        setGroupHost(data.newHostUserId);
      }

      // Show toast notification
      pushNotification(leavingName, 'leave');
    },
    [roomId, participants, removeGroupParticipant, setGroupHost, pushNotification],
  );

  const handleUserKicked = useCallback(
    (data: { roomId: string; kickedBy: string }) => {
      if (data.roomId !== roomId) return;
      endCall();
    },
    [roomId],
  );

  const handleMediaChanged = useCallback(
    (data: { roomId: string; userId: string; isMuted?: boolean; isVideoOff?: boolean }) => {
      if (data.roomId !== roomId) return;
      updateGroupParticipantMedia(data.userId, {
        isMuted: data.isMuted,
        isVideoOff: data.isVideoOff,
      });
    },
    [roomId, updateGroupParticipantMedia],
  );



  const handleVideoFrame = useCallback(
    (data: any) => {
      if (String(data.conversationId) !== String(conversationId)) return;
      if (data.frame && data.fromUserId) {
        setRemoteFrames((prev) => ({
          ...prev,
          [data.fromUserId]: data.frame,
        }));
      }
    },
    [conversationId],
  );

  const handleAudioFrame = useCallback(
    (data: any) => {
      if (String(data.conversationId) !== String(conversationId)) return;
      if (data.audio) {
        const audioData = data.audio.startsWith('data:')
          ? data.audio
          : `data:audio/mp4;base64,${data.audio}`;
        
        const audio = new Audio(audioData);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    },
    [conversationId],
  );

  // ───────────── Frame Capture for Mobile ─────────────

  useEffect(() => {
    if (callStatus !== 'in-call' || callType !== 'video' || isVideoOff || !localStream) return;

    const interval = setInterval(() => {
      const video = hiddenVideoRef.current;
      if (!video) return;

      if (video.srcObject !== localStream) {
        video.srcObject = localStream;
        video.muted = true;
        video.play().catch(() => {});
      }

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.5);
        socketService.getSocket()?.emit('video:frame', {
          conversationId,
          frame,
          isGroupCall: true,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [callStatus, callType, isVideoOff, localStream, conversationId]);

  useEffect(() => {
    if (callStatus !== 'in-call' || !localStream || isMuted) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    const audioTracks = localStream.getAudioTracks();
    if (!audioTracks.length) return;

    let cancelled = false;
    let intervalId: number | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let processorNode: ScriptProcessorNode | null = null;
    let silentGain: GainNode | null = null;
    let captureContext: AudioContext | null = null;
    const pcmChunks: Float32Array[] = [];
    let sentCount = 0;

    (async () => {
      try {
        const audioOnlyStream = new MediaStream(audioTracks);
        captureContext = new AudioContext();
        if (captureContext.state === 'suspended') {
          await captureContext.resume();
        }

        sourceNode = captureContext.createMediaStreamSource(audioOnlyStream);
        processorNode = captureContext.createScriptProcessor(4096, 1, 1);
        silentGain = captureContext.createGain();
        silentGain.gain.value = 0;

        sourceNode.connect(processorNode);
        processorNode.connect(silentGain);
        silentGain.connect(captureContext.destination);

        processorNode.onaudioprocess = (event) => {
          const channelData = event.inputBuffer.getChannelData(0);
          pcmChunks.push(new Float32Array(channelData));
        };

        intervalId = window.setInterval(async () => {
          if (cancelled) return;
          if (!pcmChunks.length) return;

          try {
            const merged = mergeFloat32Chunks(pcmChunks.splice(0, pcmChunks.length));
            const wavBlob = audioBufferToWavBlob(merged, captureContext!.sampleRate);
            const base64 = await blobToDataUrl(wavBlob);
            socket.emit('video:audio-frame', {
              conversationId,
              audio: base64,
              audioMimeType: 'audio/wav',
              isGroupCall: true,
            });
            sentCount += 1;
            if (sentCount % 5 === 0) {
              console.log('[GroupCall] Sent audio chunks:', sentCount, 'mime: audio/wav');
            }
          } catch (e) {
            console.warn('[GroupCall] WAV audio emit failed:', e);
          }
        }, 1200);
      } catch (e) {
        console.warn('[GroupCall] Audio pipeline init failed:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      if (processorNode) {
        processorNode.onaudioprocess = null;
        try {
          processorNode.disconnect();
        } catch {
          // noop
        }
      }
      if (sourceNode) {
        try {
          sourceNode.disconnect();
        } catch {
          // noop
        }
      }
      if (silentGain) {
        try {
          silentGain.disconnect();
        } catch {
          // noop
        }
      }
      if (captureContext) {
        captureContext.close().catch(() => {
          // noop
        });
      }
    };
  }, [callStatus, localStream, isMuted, conversationId]);

  // ───────────── Initialize Call ─────────────

  useEffect(() => {
    if (!isActive || !user?.id || !roomId) return;

    let mounted = true;
    const socket = socketService.getSocket();
    if (!socket) return;



    // Bind WebRTC signaling listeners
    socket.on('webrtc:offer', handleWebRTCOffer);
    socket.on('webrtc:answer', handleWebRTCAnswer);
    socket.on('webrtc:ice-candidate', handleICECandidate);
    socket.on('group:user-joined', handleUserJoined);
    socket.on('group:user-left', handleUserLeft);
    socket.on('group:user-kicked', handleUserKicked);
    socket.on('group:media-changed', handleMediaChanged);
    socket.on('video:frame', handleVideoFrame);
    socket.on('video:audio-frame', handleAudioFrame);

    const initCall = async () => {
      // Create mesh manager
      const mesh = new WebRTCMeshManager(user.id, roomId);
      meshRef.current = mesh;

      // Initialize local media
      try {
        await mesh.initLocalStream(callType);
      } catch (err: any) {
        console.error('[GroupCall] Failed to get media:', err);
        const name = String(err?.name || '');
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          alert('Trình duyệt đang chặn Camera/Microphone. Hãy cấp quyền rồi thử lại.');
        } else {
          alert('Không thể truy cập Camera/Microphone. Vui lòng thử lại.');
        }
        clearGroupCall();
        return;
      }

      if (!mounted) {
        mesh.closeAll();
        return;
      }

      // Join the room
      socket.emit('group:join', { roomId }, async (res: any) => {
        if (!mounted) return;
        if (!res?.success) {
          console.error('[GroupCall] Join failed:', res?.error);
          alert(res?.error || 'Không thể tham gia cuộc gọi');
          mesh.closeAll();
          clearGroupCall();
          return;
        }

        setGroupCallStatus('connected');

        // Add existing participants and create peer connections to them
        const existing = res.existingParticipants || [];
        for (const participant of existing) {
          if (participant.userId === user.id) continue;

          addGroupParticipant({
            userId: participant.userId,
            name: participant.name || participant.userId,
            isMuted: participant.isMuted || false,
            isVideoOff: participant.isVideoOff || false,
          });

          // New joiner creates offers to existing participants
          await mesh.createPeerConnection(participant.userId, true);
        }

        if (existing.length > 0) {
          setGroupCallStatus('in-call');
        }

        // Start active speaker detection
        mesh.startSpeakerDetection((speakerId) => {
          setGroupActiveSpeaker(speakerId);
        });
      });
    };

    initCall();

    return () => {
      mounted = false;
      socket.off('webrtc:offer', handleWebRTCOffer);
      socket.off('webrtc:answer', handleWebRTCAnswer);
      socket.off('webrtc:ice-candidate', handleICECandidate);
      socket.off('group:user-joined', handleUserJoined);
      socket.off('group:user-left', handleUserLeft);
      socket.off('group:user-kicked', handleUserKicked);
      socket.off('group:media-changed', handleMediaChanged);
      socket.off('video:frame', handleVideoFrame);
      socket.off('video:audio-frame', handleAudioFrame);
    };
  }, [isActive, user?.id, roomId, callType]);

  // ───────────── Actions ─────────────

  const endCall = () => {
    if (roomId) {
      socketService.getSocket()?.emit('group:leave', { roomId }, () => {});
    }

    meshRef.current?.closeAll();
    meshRef.current = null;
    callStartedAt.current = null;
    setCallDuration(0);
    clearGroupCall();
  };

  const toggleMute = () => {
    meshRef.current?.toggleMute();
  };

  const toggleVideo = () => {
    meshRef.current?.toggleVideo();
  };

  const toggleScreenShare = async () => {
    if (!meshRef.current) return;
    if (isScreenSharing) {
      await meshRef.current.stopScreenShare();
    } else {
      await meshRef.current.startScreenShare();
    }
  };

  const kickUser = (targetUserId: string) => {
    if (!roomId || !isHost) return;
    socketService.getSocket()?.emit('group:kick', { roomId, targetUserId }, (res: any) => {
      if (!res?.success) {
        console.error('[GroupCall] Kick failed:', res?.error);
      }
    });
  };

  // ───────────── Render ─────────────

  if (!isActive) return null;

  // Build tile data (local + remote)
  const allTiles: {
    userId: string;
    stream: MediaStream | null;
    frame: string | null;
    label: string;
    isMuted: boolean;
    isVideoOff: boolean;
    isLocal: boolean;
    avatar?: string | null;
  }[] = [];

  // Local tile
  allTiles.push({
    userId: user?.id || '',
    stream: localStream,
    frame: null,
    label: 'Bạn',
    isMuted,
    isVideoOff,
    isLocal: true,
    avatar: user?.avatarUrl,
  });

  // Remote tiles
  for (const [userId, participant] of Object.entries(participants)) {
    allTiles.push({
      userId,
      stream: remoteStreams[userId] || null,
      frame: remoteFrames[userId] || null,
      label: participant.name || userId,
      isMuted: participant.isMuted,
      isVideoOff: participant.isVideoOff,
      isLocal: false,
      avatar: participant.avatar,
    });
  }

  const participantCount = allTiles.length;
  const participantEntries = Object.entries(participants);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900 animate-in fade-in duration-300">
      <video ref={hiddenVideoRef} className="hidden" />
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-sm z-10">
        <div>
          <h2 className="text-white text-lg font-bold">
            {callType === 'video' ? 'Cuộc gọi video nhóm' : 'Cuộc gọi thoại nhóm'}
          </h2>
          <p className="text-white/60 text-sm">
            {callStatus === 'joining' && 'Đang kết nối...'}
            {callStatus === 'connected' && 'Đang chờ người tham gia...'}
            {callStatus === 'in-call' && (
              <>
                {participantCount} người tham gia
                {callDuration > 0 && ` · ${formatDuration(callDuration)}`}
              </>
            )}
          </p>
        </div>

        <button
          onClick={() => setShowParticipants(!showParticipants)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">{participantCount}</span>
        </button>
      </div>

      {/* Toast Notifications */}
      <div className="absolute top-20 right-6 z-20 flex flex-col gap-2 pointer-events-none">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/70 backdrop-blur-md text-white text-sm font-medium shadow-lg animate-in slide-in-from-right fade-in duration-300"
          >
            {notif.type === 'join' ? (
              <LogIn className="w-4 h-4 text-green-400 flex-shrink-0" />
            ) : (
              <LogOut className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span>
              {notif.name}{' '}
              {notif.type === 'join' ? 'đã tham gia' : 'đã rời đi'}
            </span>
          </div>
        ))}
      </div>

      {/* Video Grid + Participant Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className={`flex-1 p-3 grid gap-2 ${getGridClass(participantCount)}`}>
          {allTiles.map((tile) => (
            <VideoTile
              key={tile.userId}
              stream={tile.stream}
              frame={tile.frame}
              label={tile.label}
              isMuted={tile.isMuted}
              isVideoOff={tile.isVideoOff}
              isActiveSpeaker={activeSpeaker === tile.userId}
              isLocal={tile.isLocal}
              avatar={tile.avatar}
            />
          ))}
        </div>

        {/* Participant Panel */}
        {showParticipants && (
          <div className="w-72 bg-gray-800/90 backdrop-blur-md border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-white font-semibold">Thành viên ({participantCount})</h3>
              <button
                onClick={() => setShowParticipants(false)}
                className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* Self */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-9 h-9 rounded-full bg-primary-500/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    Bạn {hostUserId === user?.id && '(Host)'}
                  </p>
                </div>
                {isMuted && <MicOff className="w-4 h-4 text-red-400 flex-shrink-0" />}
              </div>

              {/* Others */}
              {participantEntries.map(([userId, p]) => (
                <div key={userId} className="flex items-center gap-3 px-4 py-2.5 group">
                  <div className="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 overflow-hidden">
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (p.name || userId).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate flex items-center gap-1">
                      {p.name || userId}
                      {userId === hostUserId && (
                        <Crown className="w-3.5 h-3.5 text-yellow-400" />
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                    {p.isVideoOff && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                    {isHost && userId !== user?.id && (
                      <button
                        onClick={() => kickUser(userId)}
                        className="w-6 h-6 rounded-full hover:bg-red-500/30 items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                        title="Kick"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-center gap-4 px-6 py-5 bg-black/40 backdrop-blur-sm">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isMuted
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isMuted ? 'Bật mic' : 'Tắt mic'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isVideoOff
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isVideoOff ? 'Bật camera' : 'Tắt camera'}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        {callType === 'video' && (
          <button
            onClick={toggleScreenShare}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isScreenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
          >
            {isScreenSharing ? (
              <MonitorOff className="w-6 h-6" />
            ) : (
              <Monitor className="w-6 h-6" />
            )}
          </button>
        )}

        <button
          onClick={endCall}
          className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-lg shadow-red-500/50 mx-2"
          title="Kết thúc"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
