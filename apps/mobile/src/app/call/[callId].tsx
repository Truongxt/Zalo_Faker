import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from "react-native-webrtc";
import { Avatar } from "@/components/ui/Avatar";
import { groupCallInviteStore } from "@/lib/groupCallInviteStore";
import { socketService } from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";

type CallType = "video" | "audio";
type CallState = "ringing" | "accepted" | "ended";
type CallNotice = { id: string; text: string };

type PeerState = {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: any[];
};

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

const getStreamUrl = (stream: MediaStream | null) => {
  if (!stream) return "";
  return typeof (stream as any).toURL === "function" ? (stream as any).toURL() : "";
};

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // noop
    }
  });
};

export default function CallScreen() {
  const params = useLocalSearchParams<any>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useAuthStore();

  const callType: CallType = params.callType === "video" ? "video" : "audio";
  const isCaller = String(params.isCaller) === "true";
  const autoAccept = String(params.autoAccept) === "true";
  const isGroupCall = String(params.isGroupCall) === "true";
  const toUserId = String(params.toUserId || "");
  const fromUserId = String(params.fromUserId || user?.id || "");
  const conversationId = String(params.conversationId || params.callId || "");
  const roomIdParam = String(params.roomId || "");
  const initialCallState: CallState = autoAccept || (isGroupCall && isCaller) ? "accepted" : "ringing";

  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomIdParam || null);
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [participantMedia, setParticipantMedia] = useState<Record<string, { isMuted?: boolean; isVideoOff?: boolean }>>({});
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [isLocalVideoOff, setIsLocalVideoOff] = useState(false);
  const [notices, setNotices] = useState<CallNotice[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeRoomIdRef = useRef<string | null>(roomIdParam || null);
  const joinedGroupRoomRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const hasEmittedInitialSignal = useRef(false);
  const noticeIdRef = useRef(0);
  const participantNamesRef = useRef<Record<string, string>>({});

  const displayName = useMemo(() => {
    if (isCaller) return String(params.toUserName || "Nguoi dung");
    return String(params.callerName || "Nguoi dung");
  }, [isCaller, params.callerName, params.toUserName]);

  const displayAvatar = useMemo(() => {
    if (isCaller) return params.toUserAvatar || null;
    return params.callerAvatar || null;
  }, [isCaller, params.callerAvatar, params.toUserAvatar]);

  const remoteUserId = isCaller ? toUserId : fromUserId;
  const isPortrait = height >= width;

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    participantNamesRef.current = participantNames;
  }, [participantNames]);

  useEffect(() => {
    const nextNames: Record<string, string> = {};
    const candidateRemoteId = isCaller ? String(toUserId || "") : String(fromUserId || "");
    if (candidateRemoteId && candidateRemoteId !== String(user?.id || "")) {
      nextNames[candidateRemoteId] = displayName;
    }
    setParticipantNames((prev) => ({ ...prev, ...nextNames }));
  }, [displayName, fromUserId, isCaller, toUserId, user?.id]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const pushNotice = useCallback((text: string) => {
    const id = `notice-${Date.now()}-${noticeIdRef.current++}`;
    setNotices((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setNotices((prev) => prev.filter((item) => item.id !== id));
    }, 2500);
  }, []);

  const getTileStyle = (_index: number, totalTiles: number) => {
    if (totalTiles <= 1) return { width: "100%", height: "100%" as const };
    if (totalTiles === 2) {
      return isPortrait
        ? { width: "100%", height: "50%" as const }
        : { width: "50%", height: "100%" as const };
    }
    if (totalTiles <= 4) return { width: "50%", height: "50%" as const };
    return { width: "50%", height: "33.33%" as const };
  };

  const emitSignal = useCallback((event: string, targetUserId: string, payload: Record<string, unknown>) => {
    if (!targetUserId) return;
    socketService.emit(event, {
      toUserId: targetUserId,
      roomId: activeRoomIdRef.current || conversationId,
      ...payload,
    });
  }, [conversationId]);

  const addRemoteStream = useCallback((remoteId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => ({ ...prev, [remoteId]: stream }));
    setIsRemoteAccepted(true);
  }, []);

  const closePeer = useCallback((remoteId: string) => {
    const peerState = peersRef.current.get(remoteId);
    if (peerState) {
      try {
        peerState.pc.close();
      } catch {
        // noop
      }
      peersRef.current.delete(remoteId);
    }

    setRemoteStreams((prev) => {
      const existing = prev[remoteId];
      if (existing) stopStream(existing);
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
  }, []);

  const cleanupWebRTC = useCallback(() => {
    peersRef.current.forEach((peerState) => {
      try {
        peerState.pc.close();
      } catch {
        // noop
      }
    });
    peersRef.current.clear();
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams((prev) => {
      Object.values(prev).forEach(stopStream);
      return {};
    });
    joinedGroupRoomRef.current = null;
  }, []);

  const createPeerConnection = useCallback(async (targetUserId: string, shouldCreateOffer: boolean) => {
    if (!targetUserId || targetUserId === String(user?.id || "")) return null;

    const existing = peersRef.current.get(targetUserId);
    if (existing) {
      if (shouldCreateOffer && existing.pc.signalingState === "stable") {
        try {
          existing.makingOffer = true;
          const offer = await existing.pc.createOffer();
          await existing.pc.setLocalDescription(offer);
          emitSignal("webrtc:offer", targetUserId, { offer: existing.pc.localDescription });
        } finally {
          existing.makingOffer = false;
        }
      }
      return existing.pc;
    }

    const stream = localStreamRef.current;
    if (!stream) return null;

    const pc = new RTCPeerConnection(RTC_CONFIG as any);
    const peerState: PeerState = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
    };
    peersRef.current.set(targetUserId, peerState);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    (pc as any).ontrack = (event: any) => {
      const [remoteStream] = event.streams || [];
      if (remoteStream) {
        addRemoteStream(targetUserId, remoteStream);
      }
    };

    (pc as any).onaddstream = (event: any) => {
      if (event?.stream) {
        addRemoteStream(targetUserId, event.stream);
      }
    };

    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        emitSignal("webrtc:ice-candidate", targetUserId, {
          candidate: event.candidate,
        });
      }
    };

    (pc as any).onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setIsRemoteAccepted(true);
      }
      if (state === "failed" || state === "closed" || state === "disconnected") {
        console.log("[Mobile WebRTC] peer state", targetUserId, state);
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setIsRemoteAccepted(true);
      }
    };

    if (shouldCreateOffer) {
      try {
        peerState.makingOffer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSignal("webrtc:offer", targetUserId, { offer: pc.localDescription });
      } catch (err) {
        console.warn("[Mobile WebRTC] create offer failed:", err);
      } finally {
        peerState.makingOffer = false;
      }
    }

    return pc;
  }, [addRemoteStream, emitSignal, user?.id]);

  const handleOffer = useCallback(async (fromId: string, offer: any) => {
    if (!fromId || !offer) return;

    let peerState = peersRef.current.get(fromId);
    if (!peerState) {
      await createPeerConnection(fromId, false);
      peerState = peersRef.current.get(fromId);
    }
    if (!peerState) return;

    const pc = peerState.pc;
    const isPolite = String(user?.id || "") < String(fromId);
    const offerCollision = peerState.makingOffer || pc.signalingState !== "stable";
    peerState.ignoreOffer = !isPolite && offerCollision;
    if (peerState.ignoreOffer) return;

    try {
      if (offerCollision) {
        await pc.setLocalDescription({ type: "rollback" } as any);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      for (const candidate of peerState.pendingCandidates.splice(0)) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emitSignal("webrtc:answer", fromId, { answer: pc.localDescription });
      setIsRemoteAccepted(true);
    } catch (err) {
      console.warn("[Mobile WebRTC] handle offer failed:", err);
    }
  }, [createPeerConnection, emitSignal, user?.id]);

  const handleAnswer = useCallback(async (fromId: string, answer: any) => {
    const peerState = peersRef.current.get(fromId);
    if (!peerState || !answer) return;

    try {
      await peerState.pc.setRemoteDescription(new RTCSessionDescription(answer));
      for (const candidate of peerState.pendingCandidates.splice(0)) {
        await peerState.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      setIsRemoteAccepted(true);
    } catch (err) {
      console.warn("[Mobile WebRTC] handle answer failed:", err);
    }
  }, []);

  const handleIceCandidate = useCallback(async (fromId: string, candidate: any) => {
    let peerState = peersRef.current.get(fromId);
    if (!peerState) {
      await createPeerConnection(fromId, false);
      peerState = peersRef.current.get(fromId);
    }
    if (!peerState || !candidate) return;

    if (!peerState.pc.remoteDescription) {
      peerState.pendingCandidates.push(candidate);
      return;
    }

    try {
      await peerState.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      if (!peerState.ignoreOffer) {
        console.warn("[Mobile WebRTC] add ICE failed:", err);
      }
    }
  }, [createPeerConnection]);

  const initLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video"
        ? {
            facingMode: "user",
            width: 640,
            height: 480,
            frameRate: 24,
          }
        : false,
    } as any);

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, [callType]);

  const mergeParticipantNamesFromJoin = useCallback((joinRes: any) => {
    const list = Array.isArray(joinRes?.existingParticipants) ? joinRes.existingParticipants : [];
    if (!list.length) return;

    setParticipantNames((prev) => {
      const next = { ...prev };
      list.forEach((participant: any) => {
        const uid = String(participant?.userId || "");
        if (!uid) return;
        next[uid] =
          String(participant?.name || participant?.userName || "").trim()
          || String(participant?.userId || "").trim()
          || "Nguoi dung";
      });
      return next;
    });
  }, []);

  const joinGroupRoom = useCallback(async (roomId: string) => {
    const socket = socketService.getSocket();
    if (!socket || !roomId || joinedGroupRoomRef.current === roomId) return;

    socket.emit("group:join", { roomId }, async (res: any) => {
      if (!mountedRef.current) return;
      if (!res?.success) {
        Alert.alert("Khong the tham gia cuoc goi", res?.error || "Vui long thu lai");
        return;
      }

      joinedGroupRoomRef.current = roomId;
      setActiveRoomId(roomId);
      groupCallInviteStore.remove(conversationId);
      mergeParticipantNamesFromJoin(res);

      const existingParticipants = Array.isArray(res.existingParticipants) ? res.existingParticipants : [];
      for (const participant of existingParticipants) {
        const uid = String(participant?.userId || "");
        if (!uid || uid === String(user?.id || "")) continue;
        setParticipantMedia((prev) => ({
          ...prev,
          [uid]: {
            isMuted: Boolean(participant?.isMuted),
            isVideoOff: Boolean(participant?.isVideoOff),
          },
        }));
        await createPeerConnection(uid, true);
      }

      if (existingParticipants.length > 0) {
        setIsRemoteAccepted(true);
      }
    });
  }, [conversationId, createPeerConnection, mergeParticipantNamesFromJoin, user?.id]);

  const endCallLocal = useCallback((notifyRemote = true) => {
    cleanupWebRTC();
    setCallState("ended");

    if (notifyRemote) {
      if (isGroupCall) {
        const leaveRoomId = String(activeRoomIdRef.current || roomIdParam || "");
        if (leaveRoomId) {
          socketService.emit("group:leave", { roomId: leaveRoomId }, () => {});
        }
        socketService.emit("video:leave-call", {
          fromUserId: String(user?.id || ""),
          conversationId,
          isGroupCall: true,
        });
      } else if (remoteUserId) {
        socketService.emit("video:end-call", {
          toUserId: remoteUserId,
          fromUserId: String(user?.id || ""),
          conversationId,
          isGroupCall: false,
        });
      }
    }

    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/chat/chats");
    }, 450);
  }, [cleanupWebRTC, conversationId, isGroupCall, remoteUserId, roomIdParam, router, user?.id]);

  useEffect(() => {
    if (!conversationId) return;
    socketService.joinRoom(conversationId);
    return () => {
      socketService.leaveRoom(conversationId);
    };
  }, [conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    const socket = socketService.getSocket();
    if (!socket || !user?.id) return;

    const handleAnswered = (data: any) => {
      if (isGroupCall) return;
      if (!isCaller || String(data?.toUserId || "") !== String(user.id)) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      setCallState("accepted");
      setIsRemoteAccepted(true);
    };

    const handleRejected = (data: any) => {
      if (!isGroupCall && String(data?.toUserId || "") !== String(user.id)) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      Alert.alert("Cuoc goi bi tu choi", "Dau ben kia da tu choi cuoc goi", [
        { text: "Dong", onPress: () => endCallLocal(false) },
      ]);
    };

    const handleEnded = (data: any) => {
      if (!isGroupCall && String(data?.toUserId || "") !== String(user.id)) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      Alert.alert("Ket thuc", "Cuoc goi da ket thuc", [
        { text: "Dong", onPress: () => endCallLocal(false) },
      ]);
    };

    const handleUserLeft = (data: any) => {
      if (String(data?.conversationId || "") !== conversationId) return;
      const leftUserId = String(data?.userId || data?.fromUserId || "");
      if (!leftUserId) return;
      closePeer(leftUserId);
      setParticipantNames((prev) => {
        const next = { ...prev };
        delete next[leftUserId];
        return next;
      });
      setParticipantMedia((prev) => {
        const next = { ...prev };
        delete next[leftUserId];
        return next;
      });
    };

    const handleGroupUserJoined = async (data: any) => {
      if (!isGroupCall) return;
      if (String(data?.roomId || "") !== String(activeRoomIdRef.current || roomIdParam || "")) return;
      const joinedUserId = String(data?.userId || "");
      if (!joinedUserId || joinedUserId === String(user.id)) return;

      const joinedName = String(data?.userName || "Nguoi dung");
      setParticipantNames((prev) => ({ ...prev, [joinedUserId]: joinedName }));
      pushNotice(`${joinedName} da tham gia`);

      if (localStreamRef.current) {
        await createPeerConnection(joinedUserId, false);
      }
    };

    const handleGroupUserLeft = (data: any) => {
      if (!isGroupCall) return;
      if (String(data?.roomId || "") !== String(activeRoomIdRef.current || roomIdParam || "")) return;
      const leftUserId = String(data?.userId || data?.fromUserId || "");
      if (!leftUserId) return;
      const leftName = participantNamesRef.current[leftUserId] || "Nguoi dung";
      closePeer(leftUserId);
      setParticipantNames((prev) => {
        const next = { ...prev };
        delete next[leftUserId];
        return next;
      });
      setParticipantMedia((prev) => {
        const next = { ...prev };
        delete next[leftUserId];
        return next;
      });
      if (leftUserId !== String(user.id)) {
        pushNotice(`${leftName} da roi cuoc goi`);
      }
    };

    const handleMediaChanged = (data: any) => {
      if (!isGroupCall) return;
      if (String(data?.roomId || "") !== String(activeRoomIdRef.current || roomIdParam || "")) return;
      const changedUserId = String(data?.userId || "");
      if (!changedUserId || changedUserId === String(user.id)) return;

      setParticipantMedia((prev) => ({
        ...prev,
        [changedUserId]: {
          ...prev[changedUserId],
          isMuted: typeof data?.isMuted === "boolean" ? data.isMuted : prev[changedUserId]?.isMuted,
          isVideoOff: typeof data?.isVideoOff === "boolean" ? data.isVideoOff : prev[changedUserId]?.isVideoOff,
        },
      }));

      const name = participantNamesRef.current[changedUserId] || "Nguoi dung";
      if (typeof data?.isMuted === "boolean") {
        pushNotice(data.isMuted ? `${name} da tat mic` : `${name} da bat mic`);
      }
      if (typeof data?.isVideoOff === "boolean" && callType === "video") {
        pushNotice(data.isVideoOff ? `${name} da tat camera` : `${name} da bat camera`);
      }
    };

    const handleRoomEnded = (data: any) => {
      if (String(data?.conversationId || "") !== conversationId) return;
      endCallLocal(false);
    };

    const handleWebRTCOffer = async (data: any) => {
      if (isGroupCall && String(data?.roomId || "") !== String(activeRoomIdRef.current || roomIdParam || "")) return;
      if (!isGroupCall && String(data?.fromUserId || "") !== String(remoteUserId || "")) return;
      await handleOffer(String(data?.fromUserId || ""), data?.offer);
    };

    const handleWebRTCAnswer = async (data: any) => {
      if (isGroupCall && String(data?.roomId || "") !== String(activeRoomIdRef.current || roomIdParam || "")) return;
      if (!isGroupCall && String(data?.fromUserId || "") !== String(remoteUserId || "")) return;
      await handleAnswer(String(data?.fromUserId || ""), data?.answer);
    };

    const handleWebRTCIce = async (data: any) => {
      if (isGroupCall && String(data?.roomId || "") !== String(activeRoomIdRef.current || roomIdParam || "")) return;
      if (!isGroupCall && String(data?.fromUserId || "") !== String(remoteUserId || "")) return;
      await handleIceCandidate(String(data?.fromUserId || ""), data?.candidate);
    };

    socket.on("video:call-answered", handleAnswered);
    socket.on("video:call-rejected", handleRejected);
    socket.on("video:call-ended", handleEnded);
    socket.on("video:user-left", handleUserLeft);
    socket.on("group:user-joined", handleGroupUserJoined);
    socket.on("group:user-left", handleGroupUserLeft);
    socket.on("group:media-changed", handleMediaChanged);
    socket.on("group:room-ended", handleRoomEnded);
    socket.on("group:user-kicked", handleRoomEnded);
    socket.on("webrtc:offer", handleWebRTCOffer);
    socket.on("webrtc:answer", handleWebRTCAnswer);
    socket.on("webrtc:ice-candidate", handleWebRTCIce);

    if (!hasEmittedInitialSignal.current) {
      hasEmittedInitialSignal.current = true;

      if (isCaller) {
        if (isGroupCall) {
          socket.emit("group:create", {
            conversationId,
            callType,
            autoInvite: true,
          }, (res: any) => {
            if (!mountedRef.current) return;
            if (res?.success && res?.room?.roomId) {
              setActiveRoomId(res.room.roomId);
              setCallState("accepted");
              groupCallInviteStore.remove(conversationId);
            } else {
              Alert.alert("Khong the tao cuoc goi", res?.error || "Vui long thu lai");
              endCallLocal(false);
            }
          });
        } else if (toUserId) {
          socket.emit("video:call-user", {
            fromUserId: String(user.id),
            toUserId,
            conversationId,
            callerName: user.fullName || "Nguoi dung",
            callerAvatar: user.avatarUrl || null,
            callType,
            isGroupCall: false,
          });
        }
      } else if (autoAccept) {
        socket.emit("video:answer-call", {
          toUserId: isGroupCall ? undefined : fromUserId,
          fromUserId: String(user.id),
          conversationId,
          isGroupCall,
        });
      }
    }

    return () => {
      mountedRef.current = false;
      socket.off("video:call-answered", handleAnswered);
      socket.off("video:call-rejected", handleRejected);
      socket.off("video:call-ended", handleEnded);
      socket.off("video:user-left", handleUserLeft);
      socket.off("group:user-joined", handleGroupUserJoined);
      socket.off("group:user-left", handleGroupUserLeft);
      socket.off("group:media-changed", handleMediaChanged);
      socket.off("group:room-ended", handleRoomEnded);
      socket.off("group:user-kicked", handleRoomEnded);
      socket.off("webrtc:offer", handleWebRTCOffer);
      socket.off("webrtc:answer", handleWebRTCAnswer);
      socket.off("webrtc:ice-candidate", handleWebRTCIce);
    };
  }, [
    autoAccept,
    callType,
    closePeer,
    conversationId,
    createPeerConnection,
    endCallLocal,
    fromUserId,
    handleAnswer,
    handleIceCandidate,
    handleOffer,
    isCaller,
    isGroupCall,
    pushNotice,
    remoteUserId,
    roomIdParam,
    toUserId,
    user?.avatarUrl,
    user?.fullName,
    user?.id,
  ]);

  useEffect(() => {
    if (callState !== "accepted" || !user?.id) return;
    if (isGroupCall && !activeRoomId) return;
    if (!isGroupCall && !remoteUserId) return;

    let cancelled = false;

    const run = async () => {
      try {
        await initLocalMedia();
        if (cancelled || !mountedRef.current) return;

        if (isGroupCall) {
          await joinGroupRoom(String(activeRoomId));
        } else {
          await createPeerConnection(remoteUserId, isCaller);
        }
      } catch (err: any) {
        console.error("[Mobile WebRTC] media init failed:", err);
        const name = String(err?.name || "");
        if (name === "NotAllowedError" || name === "SecurityError") {
          Alert.alert("Can quyen camera/microphone", "Hay cap quyen roi thu lai.");
        } else {
          Alert.alert("Khong the mo camera/microphone", "Vui long thu lai.");
        }
        endCallLocal(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    activeRoomId,
    callState,
    createPeerConnection,
    endCallLocal,
    initLocalMedia,
    isCaller,
    isGroupCall,
    joinGroupRoom,
    remoteUserId,
    user?.id,
  ]);

  useEffect(() => {
    return () => {
      cleanupWebRTC();
    };
  }, [cleanupWebRTC]);

  const acceptCall = () => {
    socketService.emit("video:answer-call", {
      toUserId: isGroupCall ? undefined : fromUserId,
      fromUserId: String(user?.id || ""),
      conversationId,
      isGroupCall,
    });
    if (isGroupCall && roomIdParam) {
      setActiveRoomId(roomIdParam);
    }
    setCallState("accepted");
    setIsRemoteAccepted(false);
  };

  const rejectCall = () => {
    if (!isGroupCall && remoteUserId) {
      socketService.emit("video:reject-call", {
        toUserId: remoteUserId,
        fromUserId: String(user?.id || ""),
        conversationId,
        isGroupCall: false,
      });
    }
    endCallLocal(false);
  };

  const toggleMute = () => {
    const nextMuted = !isLocalMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsLocalMuted(nextMuted);

    const roomId = String(activeRoomIdRef.current || roomIdParam || "");
    if (isGroupCall && roomId) {
      socketService.emit("group:media-toggle", { roomId, isMuted: nextMuted });
    }
  };

  const toggleVideo = () => {
    if (callType !== "video") return;
    const nextVideoOff = !isLocalVideoOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !nextVideoOff;
    });
    setIsLocalVideoOff(nextVideoOff);

    const roomId = String(activeRoomIdRef.current || roomIdParam || "");
    if (isGroupCall && roomId) {
      socketService.emit("group:media-toggle", { roomId, isVideoOff: nextVideoOff });
    }
  };

  const remoteEntries = Object.entries(remoteStreams);
  const allGroupTiles = [
    { userId: String(user?.id || "local"), stream: localStream, isLocal: true },
    ...remoteEntries.map(([uid, stream]) => ({ userId: uid, stream, isLocal: false })),
  ];

  const renderAvatarState = () => (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={{
            position: "absolute",
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            transform: [{ scale: pulseAnim }],
          }}
        />
        <View style={{ width: 120, height: 120, borderRadius: 60, overflow: "hidden", borderWidth: 4, borderColor: "#3b82f6" }}>
          <Avatar uri={displayAvatar} size={120} name={displayName} />
        </View>
      </View>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginTop: 24 }}>
        {displayName}
      </Text>
      <Text style={{ color: "#9ca3af", fontSize: 16, marginTop: 8 }}>
        {callState === "ended"
          ? "Da ket thuc"
          : callState === "accepted"
            ? isRemoteAccepted
              ? callType === "audio"
                ? "Da ket noi thoai"
                : "Da ket noi video"
              : "Dang ket noi WebRTC..."
            : isCaller
              ? "Dang goi..."
              : "Cuoc goi den..."}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#111827" }}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />

      {callType === "video" && callState === "accepted" ? (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {isGroupCall ? (
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", marginTop: insets.top, paddingBottom: insets.bottom + 120 }}>
              {allGroupTiles.map((tile, index) => {
                const media = tile.isLocal ? { isMuted: isLocalMuted, isVideoOff: isLocalVideoOff } : participantMedia[tile.userId] || {};
                const label = tile.isLocal ? "Ban" : participantNames[tile.userId] || "Nguoi dung";
                const streamUrl = getStreamUrl(tile.stream);
                const tileStyle = getTileStyle(index, allGroupTiles.length) as any;
                return (
                  <View key={tile.userId} style={{ ...tileStyle, borderWidth: 1, borderColor: "#111827", backgroundColor: "#1f2937" }}>
                    {streamUrl && !media.isVideoOff ? (
                      <RTCView
                        streamURL={streamUrl}
                        objectFit="cover"
                        mirror={tile.isLocal}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1f2937" }}>
                        <Ionicons name="person-circle" size={54} color="#9ca3af" />
                      </View>
                    )}
                    <View style={{ position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ color: "#fff", fontSize: 12 }}>{label}</Text>
                    </View>
                    <View style={{ position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 6 }}>
                      {media.isMuted && <Ionicons name="mic-off" size={18} color="#fca5a5" />}
                      {media.isVideoOff && <Ionicons name="videocam-off" size={18} color="#fca5a5" />}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {remoteEntries[0] ? (
                <RTCView
                  streamURL={getStreamUrl(remoteEntries[0][1])}
                  objectFit="cover"
                  style={{ width: "100%", height: "100%", position: "absolute" }}
                />
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#fff" }}>Dang cho doi tac...</Text>
                </View>
              )}

              {localStream && !isLocalVideoOff && (
                <View style={{ position: "absolute", top: insets.top + 20, right: 20, width: 100, height: 150, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "#374151" }}>
                  <RTCView
                    streamURL={getStreamUrl(localStream)}
                    objectFit="cover"
                    mirror
                    style={{ flex: 1 }}
                  />
                </View>
              )}
              {isLocalVideoOff && (
                <View style={{ position: "absolute", top: insets.top + 20, right: 20, width: 100, height: 150, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "#374151", backgroundColor: "#1f2937", justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="videocam-off" size={20} color="#fff" />
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        renderAvatarState()
      )}

      {notices.length > 0 && (
        <View style={{ position: "absolute", top: insets.top + 16, right: 12, gap: 8 }}>
          {notices.map((notice) => (
            <View key={notice.id} style={{ backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: "#fff", fontSize: 12 }}>{notice.text}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ position: "absolute", bottom: insets.bottom + 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32 }}>
        {callState === "ringing" && !isCaller && (
          <TouchableOpacity
            onPress={acceptCall}
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#22c55e", justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="call" size={32} color="#fff" />
          </TouchableOpacity>
        )}

        {callState === "accepted" && (
          <TouchableOpacity
            onPress={toggleMute}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isLocalMuted ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name={isLocalMuted ? "mic-off" : "mic"} size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {callState !== "ended" && (
          <TouchableOpacity
            onPress={() => (callState === "ringing" && !isCaller ? rejectCall() : endCallLocal(true))}
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#ef4444", justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        )}

        {callState === "accepted" && callType === "video" && (
          <TouchableOpacity
            onPress={toggleVideo}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isLocalVideoOff ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name={isLocalVideoOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
