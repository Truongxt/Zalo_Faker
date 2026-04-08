import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { socketService } from "@/lib/socket";
import { Avatar } from "@/components/ui/Avatar";

type CallType = "video" | "audio";
type CallState = "ringing" | "accepted" | "ended";

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // Params encoded in callId: "<callType>_<toUserId>_<toUserName>_<isCaller>"
  // e.g. "video_123_John_true" or just callId from notification
  const [callType, setCallType] = useState<CallType>("audio");
  const [callState, setCallState] = useState<CallState>("ringing");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [remoteUserName, setRemoteUserName] = useState("Người dùng");
  const [isCaller, setIsCaller] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Parse callId to extract call info
  useEffect(() => {
    if (callId) {
      const parts = String(callId).split("_");
      if (parts.length >= 4) {
        setCallType((parts[0] as CallType) || "audio");
        setRemoteUserName(decodeURIComponent(parts[2] || "Người dùng"));
        setIsCaller(parts[3] === "true");
      } else {
        setCallType("audio");
        setIsCaller(true);
      }
    }
  }, [callId]);

  // Pulse animation for ringing state
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
  }, [callState]);

  // Timer when call accepted
  useEffect(() => {
    if (callState === "accepted") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  // Socket events for call signaling
  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) return;

    socket.on("call:accepted", () => setCallState("accepted"));
    socket.on("call:rejected", () => endCall());
    socket.on("call:ended", () => endCall());

    // Auto end if ringing for >60s
    const timeout = setTimeout(() => {
      if (callState === "ringing") endCall();
    }, 60_000);

    return () => {
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:ended");
      clearTimeout(timeout);
    };
  }, []);

  const endCall = () => {
    clearInterval(timerRef.current);
    setCallState("ended");

    const socket = socketService.getSocket();
    if (socket && callId) {
      socket.emit("call:end", { callId });
    }
    setTimeout(() => router.back(), 800);
  };

  const acceptCall = () => {
    setCallState("accepted");
    const socket = socketService.getSocket?.();
    if (socket && callId) {
      socket.emit("call:accept", { callId });
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const bgColor = callType === "video" ? "#1C1C1E" : "#0068FF";

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 16, alignItems: "center", paddingHorizontal: 24 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          {callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại"}
        </Text>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700", marginTop: 8 }}>
          {remoteUserName}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 6, fontSize: 15 }}>
          {callState === "ringing"
            ? isCaller ? "Đang đổ chuông..." : "Cuộc gọi đến"
            : callState === "accepted"
            ? formatDuration(duration)
            : "Đã kết thúc"}
        </Text>
      </View>

      {/* Avatar */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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
            <Avatar name={remoteUserName} size={114} />
          </View>
        </Animated.View>
      </View>

      {/* Controls */}
      <View style={{ paddingBottom: Math.max(insets.bottom, 40), paddingHorizontal: 40 }}>
        {callState === "ringing" && !isCaller ? (
          // Incoming: Accept + Reject
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <TouchableOpacity
              onPress={endCall}
              style={{ alignItems: "center", gap: 8 }}
            >
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
              </View>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Từ chối</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={acceptCall} style={{ alignItems: "center", gap: 8 }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#34C759", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call" size={30} color="#fff" />
              </View>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Nhận</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // In-call or outgoing controls
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 32 }}>
              <TouchableOpacity onPress={() => setIsMuted(!isMuted)} style={{ alignItems: "center", gap: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{isMuted ? "Bật mic" : "Tắt mic"}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setIsSpeaker(!isSpeaker)} style={{ alignItems: "center", gap: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isSpeaker ? "volume-high" : "volume-mute"} size={24} color="#fff" />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Loa ngoài</Text>
              </TouchableOpacity>

              {callType === "video" && (
                <TouchableOpacity onPress={() => setIsCameraOff(!isCameraOff)} style={{ alignItems: "center", gap: 8 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="#fff" />
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Camera</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* End call button */}
            <View style={{ alignItems: "center" }}>
              <TouchableOpacity onPress={endCall} style={{ alignItems: "center", gap: 8 }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Kết thúc</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
