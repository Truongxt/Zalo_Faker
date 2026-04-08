import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
  NativeModules,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { socketService } from "@/lib/socket";
import { Avatar } from "@/components/ui/Avatar";

type CallType = "video" | "audio";
type CallState = "ringing" | "accepted" | "ended";

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let cachedWebRtcModule: any | null | undefined = undefined;
const getWebRtc = () => {
  if (cachedWebRtcModule !== undefined) return cachedWebRtcModule;

  const nativeWebRtc = (NativeModules as any)?.WebRTCModule;
  if (!nativeWebRtc) {
    cachedWebRtcModule = null;
    return null;
  }

  try {
    const dynamicRequire = eval("require");
    cachedWebRtcModule = dynamicRequire("react-native-webrtc");
    return cachedWebRtcModule;
  } catch {
    cachedWebRtcModule = null;
    return null;
  }
};

export default function CallScreen() {
  const params = useLocalSearchParams<{
    callId?: string;
    callType?: string;
    conversationId?: string;
    fromUserId?: string;
    toUserId?: string;
    toUserName?: string;
    toUserAvatar?: string;
    callerName?: string;
    callerAvatar?: string;
    isCaller?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const webRtcModule = useRef<any | null>(getWebRtc()).current;
  const RTCView = webRtcModule?.RTCView;

  const callType: CallType = params.callType === "video" ? "video" : "audio";
  const isCaller = String(params.isCaller) === "true";
  const toUserId = String(params.toUserId || "");
  const fromUserId = String(params.fromUserId || user?.id || "");
  const conversationId = String(params.conversationId || "");

  const displayName = useMemo(() => {
    if (isCaller) return params.toUserName || "Nguoi dung";
    return params.callerName || "Nguoi dung";
  }, [isCaller, params.callerName, params.toUserName]);

  const displayAvatar = useMemo(() => {
    if (isCaller) return params.toUserAvatar || null;
    return params.callerAvatar || null;
  }, [isCaller, params.callerAvatar, params.toUserAvatar]);

  const [callState, setCallState] = useState<CallState>("ringing");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [remoteVideoUrl, setRemoteVideoUrl] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const callStateRef = useRef<CallState>("ringing");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const endingRef = useRef(false);

  const cleanupMedia = () => {
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
      } catch {
        // noop
      }
      pcRef.current.close();
      pcRef.current = null;
    }

    const local = localStreamRef.current;
    if (local) {
      local.getTracks().forEach((track: any) => track.stop());
      localStreamRef.current = null;
    }

    const remote = remoteStreamRef.current;
    if (remote) {
      remote.getTracks().forEach((track: any) => track.stop());
      remoteStreamRef.current = null;
    }

    pendingCandidatesRef.current = [];
    setLocalVideoUrl(null);
    setRemoteVideoUrl(null);
  };

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (callState !== "ringing") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [callState, pulseAnim]);

  useEffect(() => {
    if (callState === "accepted") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  useEffect(() => {
    socketService.connect();
    const socket = socketService.getSocket();
    if (!socket || !user?.id) return;

    const canUseWebRtc = Boolean(webRtcModule);
    const mediaDevices = webRtcModule?.mediaDevices;
    const RTCPeerConnection = webRtcModule?.RTCPeerConnection;
    const RTCIceCandidate = webRtcModule?.RTCIceCandidate;
    const RTCSessionDescription = webRtcModule?.RTCSessionDescription;

    let mounted = true;
    const targetUserId = isCaller ? toUserId : fromUserId;

    const sendSignal = (signal: any) => {
      if (!targetUserId) return;
      socketService.emit("video:signal", {
        toUserId: targetUserId,
        conversationId,
        signal,
      });
    };

    const safeAddIceCandidate = async (candidate: any) => {
      if (!canUseWebRtc) return;
      const pc = pcRef.current;
      if (!pc) return;

      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Them ICE candidate that bai:", err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const flushPendingCandidates = async () => {
      if (!canUseWebRtc) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) return;

      const pending = [...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];

      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Xu ly ICE candidate cho doi that bai:", err);
        }
      }
    };

    const handleAnswered = async (data: any) => {
      if (!isCaller || String(data?.toUserId || "") !== String(user.id)) return;

      setCallState("accepted");
      setIsRemoteAccepted(true);

      if (!canUseWebRtc) return;

      const pc = pcRef.current;
      if (!pc || pc.signalingState !== "stable") return;

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "video",
        } as any);
        await pc.setLocalDescription(offer);
        sendSignal({ type: "offer", sdp: offer.sdp });
      } catch (err) {
        console.error("Tao offer that bai:", err);
      }
    };

    const handleSignal = async (data: any) => {
      if (!canUseWebRtc || !mounted) return;
      if (String(data?.conversationId || "") !== String(conversationId || "")) return;
      if (String(data?.fromUserId || "") !== String(targetUserId || "")) return;

      const signal = data?.signal;
      const pc = pcRef.current;
      if (!pc || !signal?.type) return;

      try {
        if (signal.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: signal.sdp }));
          await flushPendingCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "answer", sdp: answer.sdp });
          setCallState("accepted");
          setIsRemoteAccepted(true);
        } else if (signal.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: signal.sdp }));
          await flushPendingCandidates();
          setCallState("accepted");
          setIsRemoteAccepted(true);
        } else if (signal.type === "ice-candidate" && signal.candidate) {
          await safeAddIceCandidate(signal.candidate);
        }
      } catch (err) {
        console.error("Xu ly WebRTC signal that bai:", err);
      }
    };

    const handleRejected = (data: any) => {
      const me = String(user.id);
      if (String(data?.toUserId || "") === me || String(data?.fromUserId || "") === me) {
        endCallLocal(false);
      }
    };

    const handleEnded = (data: any) => {
      const me = String(user.id);
      if (String(data?.toUserId || "") === me || String(data?.fromUserId || "") === me) {
        endCallLocal(false);
      }
    };

    const initWebRtc = async () => {
      if (!canUseWebRtc) return;

      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });

        if (!mounted) {
          stream.getTracks().forEach((track: any) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (callType === "video" && typeof stream.toURL === "function") {
          setLocalVideoUrl(stream.toURL());
        }

        const pc = new RTCPeerConnection(RTC_CONFIG as any);
        pcRef.current = pc;
        const pcAny = pc as any;

        stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));

        pcAny.onicecandidate = (event: any) => {
          if (!event?.candidate) return;
          sendSignal({ type: "ice-candidate", candidate: event.candidate });
        };

        pcAny.ontrack = (event: any) => {
          const [remote] = event.streams || [];
          if (remote) {
            remoteStreamRef.current = remote;
            setIsRemoteAccepted(true);
            if (callType === "video" && typeof remote.toURL === "function") {
              setRemoteVideoUrl(remote.toURL());
            }
          }
        };

        pcAny.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setCallState("accepted");
            setIsRemoteAccepted(true);
          }
        };
      } catch (err) {
        console.error("Khoi tao microphone/camera that bai:", err);
        Alert.alert("Khong mo duoc camera", "Hay cap quyen camera va microphone cho ung dung.");
      }
    };

    socket.on("video:call-answered", handleAnswered);
    socket.on("video:call-rejected", handleRejected);
    socket.on("video:call-ended", handleEnded);
    if (canUseWebRtc) {
      socket.on("video:signal", handleSignal);
    }

    initWebRtc();

    if (isCaller && toUserId) {
      socketService.emit("video:call-user", {
        fromUserId: String(user.id),
        toUserId,
        conversationId,
        callerName: user.fullName || "Nguoi dung",
        callerAvatar: user.avatarUrl || null,
        callType,
      });
    }

    const timeout = setTimeout(() => {
      if (callStateRef.current === "ringing") {
        endCall();
      }
    }, 60_000);

    return () => {
      mounted = false;
      socket.off("video:call-answered", handleAnswered);
      socket.off("video:call-rejected", handleRejected);
      socket.off("video:call-ended", handleEnded);
      if (canUseWebRtc) {
        socket.off("video:signal", handleSignal);
      }
      clearTimeout(timeout);
      cleanupMedia();
    };
  }, [callType, conversationId, fromUserId, isCaller, toUserId, user?.avatarUrl, user?.fullName, user?.id]);

  const endCallLocal = (notifyRemote = true) => {
    if (endingRef.current) return;
    endingRef.current = true;

    const targetId = isCaller ? toUserId : fromUserId;
    if (notifyRemote && targetId) {
      socketService.emit("video:end-call", {
        toUserId: targetId,
        fromUserId: String(user?.id || ""),
        conversationId,
      });
    }

    cleanupMedia();

    if (timerRef.current) clearInterval(timerRef.current);
    setCallState("ended");
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/chat/chats");
    }, 600);
  };

  const endCall = () => {
    endCallLocal(true);
  };

  const rejectCall = () => {
    const targetId = fromUserId;
    if (targetId) {
      socketService.emit("video:reject-call", {
        toUserId: targetId,
        fromUserId: String(user?.id || ""),
        conversationId,
      });
    }
    endCallLocal(false);
  };

  const acceptCall = () => {
    socketService.emit("video:answer-call", {
      toUserId: fromUserId,
      fromUserId: String(user?.id || ""),
      conversationId,
    });
    setCallState("accepted");
    setIsRemoteAccepted(true);
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      setIsMuted((v) => !v);
      return;
    }

    const track = stream.getAudioTracks()[0];
    if (!track) return;

    const nextMuted = !isMuted;
    track.enabled = !nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      setIsCameraOff((v) => !v);
      return;
    }

    const track = stream.getVideoTracks()[0];
    if (!track) return;

    const nextOff = !isCameraOff;
    track.enabled = !nextOff;
    setIsCameraOff(nextOff);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const bgColor = callType === "video" ? "#1C1C1E" : "#0068FF";
  const canRenderVideo = Boolean(RTCView && callType === "video");

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle="light-content" />

      <View style={{ paddingTop: insets.top + 16, alignItems: "center", paddingHorizontal: 24 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {callType === "video" ? "Cuoc goi video" : "Cuoc goi thoai"}
        </Text>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700", marginTop: 8 }}>
          {displayName}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6, fontSize: 15 }}>
          {callState === "ringing"
            ? isCaller
              ? "Dang do chuong..."
              : "Cuoc goi den"
            : callState === "accepted"
              ? formatDuration(duration)
              : "Da ket thuc"}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {!canRenderVideo ? (
          <Animated.View style={{ transform: [{ scale: callState === "ringing" ? pulseAnim : 1 }] }}>
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                borderWidth: 3,
                borderColor: "rgba(255,255,255,0.4)",
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Avatar name={String(displayName)} uri={displayAvatar || undefined} size={114} />
            </View>
          </Animated.View>
        ) : remoteVideoUrl ? (
          <RTCView streamURL={remoteVideoUrl} style={{ width: "100%", height: "100%" }} objectFit="cover" />
        ) : localVideoUrl ? (
          <RTCView streamURL={localVideoUrl} style={{ width: "100%", height: "100%" }} objectFit="cover" />
        ) : (
          <Animated.View style={{ transform: [{ scale: callState === "ringing" ? pulseAnim : 1 }] }}>
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                borderWidth: 3,
                borderColor: "rgba(255,255,255,0.4)",
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Avatar name={String(displayName)} uri={displayAvatar || undefined} size={114} />
            </View>
          </Animated.View>
        )}
      </View>

      {canRenderVideo && localVideoUrl && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 12,
            right: 12,
            width: 120,
            height: 180,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
            backgroundColor: "#0f172a",
          }}
        >
          <RTCView streamURL={localVideoUrl} style={{ width: "100%", height: "100%" }} objectFit="cover" mirror />
        </View>
      )}

      {!RTCView && callType === "video" && (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 150,
            backgroundColor: "rgba(0,0,0,0.45)",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 12 }}>
            Runtime hien tai chua co WebRTC native module nen camera video call khong hien.
          </Text>
        </View>
      )}

      <View style={{ paddingBottom: Math.max(insets.bottom, 40), paddingHorizontal: 40 }}>
        {callState === "ringing" && !isCaller ? (
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <TouchableOpacity onPress={rejectCall} style={{ alignItems: "center", gap: 8 }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
              </View>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Tu choi</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={acceptCall} style={{ alignItems: "center", gap: 8 }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#34C759", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call" size={30} color="#fff" />
              </View>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Nhan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 32 }}>
              <TouchableOpacity onPress={toggleMute} style={{ alignItems: "center", gap: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{isMuted ? "Bat mic" : "Tat mic"}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsSpeaker((v) => !v)} style={{ alignItems: "center", gap: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isSpeaker ? "volume-high" : "volume-mute"} size={24} color="#fff" />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Loa ngoai</Text>
              </TouchableOpacity>

              {callType === "video" && (
                <TouchableOpacity onPress={toggleCamera} style={{ alignItems: "center", gap: 8 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Camera</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ alignItems: "center" }}>
              <TouchableOpacity onPress={endCall} style={{ alignItems: "center", gap: 8 }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Ket thuc</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {!isRemoteAccepted && callState === "accepted" && (
        <View style={{ position: "absolute", top: insets.top + 64, alignSelf: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.8)" }}>Dang ket noi video...</Text>
        </View>
      )}
    </View>
  );
}
