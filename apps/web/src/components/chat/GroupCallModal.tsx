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

// ─────────────────────────────────────────────────
// Video Tile Component
// ─────────────────────────────────────────────────

function VideoTile({
  stream,
  label,
  isMuted,
  isVideoOff,
  isActiveSpeaker,
  isLocal,
  avatar,
}: {
  stream: MediaStream | null;
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
    removeGroupRemoteStream,
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
  const lastPresenceEventRef = useRef<Record<string, { type: 'join' | 'leave'; at: number }>>({});

  const pushPresenceNotification = useCallback((userId: string, name: string, type: 'join' | 'leave') => {
    const now = Date.now();
    const last = lastPresenceEventRef.current[userId];
    if (last && last.type !== type && now - last.at < 1200) {
      return;
    }
    lastPresenceEventRef.current[userId] = { type, at: now };

    const id = `notif-${++notifIdRef.current}`;
    setNotifications((prev) => [...prev, { id, name, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3500);
  }, []);

  const {
    roomId,
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
    async (data: {
      roomId: string;
      userId: string;
      userName: string;
      userAvatar: string | null;
      reconnected?: boolean;
    }) => {
      if (data.roomId !== roomId || !meshRef.current) return;
      if (!data.userId || String(data.userId) === String(user?.id)) return;

      const knownParticipant = Boolean(participants[data.userId]);
      if (data.reconnected && !knownParticipant) {
        // Ignore out-of-sync reconnect signals to avoid phantom participants.
        return;
      }

      if (!knownParticipant) {
        addGroupParticipant({
          userId: data.userId,
          name: data.userName,
          avatar: data.userAvatar || undefined,
          isMuted: false,
          isVideoOff: false,
        });
      }

      // Someone joined → we are now in an active call
      setGroupCallStatus('in-call');

      if (!data.reconnected) {
        // Show toast notification for actual joins
        pushPresenceNotification(data.userId, data.userName || 'Nguoi dung', 'join');
      }

      // The newly joined participant creates offers to existing members from
      // the group:join callback. Existing members only prepare to answer.
      await meshRef.current.createPeerConnection(data.userId, false);
    },
    [roomId, user?.id, participants, addGroupParticipant, setGroupCallStatus, pushPresenceNotification],
  );

  const handleUserLeft = useCallback(
    (data: { roomId: string; userId: string; newHostUserId?: string }) => {
      if (data.roomId !== roomId) return;
      const leftUserId = String(data.userId || '');
      if (!leftUserId) return;

      // Get participant name before removing
      const leavingName = participants[leftUserId]?.name || 'Nguoi dung';

      removeGroupParticipant(leftUserId);
      removeGroupRemoteStream(leftUserId);
      meshRef.current?.closePeer(leftUserId);

      if (data.newHostUserId) {
        setGroupHost(data.newHostUserId);
      }

      // Show toast notification
      pushPresenceNotification(leftUserId, leavingName, 'leave');
    },
    [roomId, participants, removeGroupParticipant, removeGroupRemoteStream, setGroupHost, pushPresenceNotification],
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

