import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Animated,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { socketService } from "@/lib/socket";
import { Avatar } from "@/components/ui/Avatar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

type CallType = "video" | "audio";
type CallState = "ringing" | "accepted" | "ended";
let globalAudioRecordingOwner: string | null = null;

const extractMimeTypeFromDataUrl = (value: string): string => {
  if (!value?.startsWith("data:")) return "";
  const endIndex = value.indexOf(";base64,");
  if (endIndex <= 5) return "";
  return value.slice(5, endIndex).toLowerCase();
};

const extensionFromMimeType = (mimeType: string): string => {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) return "m4a";
  return "m4a";
};

export default function CallScreen() {
  const params = useLocalSearchParams<any>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();

  const callType: CallType = params.callType === "video" ? "video" : "audio";
  const isCaller = String(params.isCaller) === "true";
  const autoAccept = String(params.autoAccept) === "true";
  const toUserId = String(params.toUserId || "");
  const fromUserId = String(params.fromUserId || user?.id || "");
  const conversationId = String(params.conversationId || params.callId || "");
  const callOwnerKeyRef = useRef(`call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const displayName = useMemo(() => {
    if (isCaller) return params.toUserName || "Nguoi dung";
    return params.callerName || "Nguoi dung";
  }, [isCaller, params.callerName, params.toUserName]);

  const displayAvatar = useMemo(() => {
    if (isCaller) return params.toUserAvatar || null;
    return params.callerAvatar || null;
  }, [isCaller, params.callerAvatar, params.toUserAvatar]);

  const [callState, setCallState] = useState<CallState>(autoAccept ? "accepted" : "ringing");
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef<any>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRecordingRef = useRef<Audio.Recording | null>(null);
  const audioLoopStartedRef = useRef(false);
  const audioChunkInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const hasEmittedInitialSignal = useRef(false);

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

    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [pulseAnim, permission, requestPermission]);

  const cleanupMedia = async () => {
    if (streamIntervalRef.current) clearTimeout(streamIntervalRef.current);
    if (audioIntervalRef.current) clearTimeout(audioIntervalRef.current);
    audioLoopStartedRef.current = false;
    audioChunkInFlightRef.current = false;
    if (audioRecordingRef.current) {
        try {
            await audioRecordingRef.current.stopAndUnloadAsync();
        } catch (e) {}
        audioRecordingRef.current = null;
    }
    if (globalAudioRecordingOwner === callOwnerKeyRef.current) {
      globalAudioRecordingOwner = null;
    }
  };

  const endCallLocal = (notifyRemote = true) => {
    cleanupMedia();
    setCallState("ended");

    if (notifyRemote) {
      const targetId = isCaller ? toUserId : fromUserId;
      if (targetId) {
        socketService.emit("video:end-call", {
          toUserId: targetId,
          fromUserId: String(user?.id || ""),
          conversationId,
        });
      }
    }

    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/chat/chats");
    }, 600);
  };

  useEffect(() => {
    // This effect re-runs when callState changes (e.g. ringing -> accepted).
    // Reset mounted flag so frame handlers and capture loop remain active.
    mountedRef.current = true;

    const socket = socketService.getSocket();
    if (!socket || !user?.id) return;

    const handleAnswered = (data: any) => {
      if (!isCaller || String(data?.toUserId || "") !== String(user.id)) return;
      setCallState("accepted");
      setIsRemoteAccepted(true);
    };

    const handleRejected = (data: any) => {
      if (
        String(data?.toUserId || "") !== String(user.id) ||
        String(data?.conversationId || "") !== conversationId
      ) {
        return;
      }
      Alert.alert("Cuộc gọi bị từ chối", "Đầu bên kia đã từ chối cuộc gọi", [
        { text: "Đóng", onPress: () => endCallLocal(false) },
      ]);
    };

    const handleEnded = (data: any) => {
      if (
        String(data?.toUserId || "") !== String(user.id) ||
        String(data?.conversationId || "") !== conversationId
      ) {
        return;
      }
      Alert.alert("Kết thúc", "Cuộc gọi đã kết thúc", [
        { text: "Đóng", onPress: () => endCallLocal(false) },
      ]);
    };

    const handleVideoFrame = (data: any) => {
      if (!mountedRef.current) return;
      
      const incomingConvId = String(data?.conversationId || "");
      if (incomingConvId !== conversationId) {
        // Log mismatch once in a while to avoid spam but show it exists
        if (Math.random() < 0.1) {
           console.log(`[MOBILE] MISMATCH convId: Recv=${incomingConvId} vs local=${conversationId}`);
        }
        return;
      }
      
      console.log(`[MOBILE] OK - Received frame from ${data.fromUserId}`);
      if (callState !== "accepted") {
        setCallState("accepted");
      }
      setIsRemoteAccepted(true);
      if (data.frame) {
        setRemoteFrame(data.frame);
      }
    };

    const handleAudioFrame = async (data: any) => {
      if (!mountedRef.current) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      if (String(data?.fromUserId || "") !== (isCaller ? toUserId : fromUserId)) return;

      if (data.audio) {
        if (callState !== "accepted") {
          setCallState("accepted");
        }
        setIsRemoteAccepted(true);
        try {
          const audioPayload = String(data.audio);
          const mimeFromPayload = extractMimeTypeFromDataUrl(audioPayload);
          const fallbackMime = String(data?.audioMimeType || "").toLowerCase();
          const mimeType = mimeFromPayload || fallbackMime || "audio/mp4";

          let base64Data = audioPayload;
          if (base64Data.includes("base64,")) {
            base64Data = base64Data.split("base64,")[1];
          }

          const extension = extensionFromMimeType(mimeType);
          const fileUri = `${FileSystem.cacheDirectory}remote_audio_${Date.now()}.${extension}`;
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
          });

          const { sound } = await Audio.Sound.createAsync(
            { uri: fileUri },
            { shouldPlay: true }
          );

          // Auto unload after play
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.didJustFinish) {
              sound.unloadAsync();
              FileSystem.deleteAsync(fileUri).catch(() => {});
            }
          });
        } catch (e) {
          console.log("[MOBILE] Audio playback error:", e);
        }
      }
    };

    const startCaptureLoop = async () => {
      if (!mountedRef.current || callType !== "video") return;
      
      const run = async () => {
        if (!mountedRef.current || !cameraRef.current) {
          streamIntervalRef.current = setTimeout(run, 1000);
          return;
        }

        try {
          const targetId = isCaller ? toUserId : fromUserId;
          // Capture image frame
          // REMOVED skipProcessing/fastMode to avoid "Failed to capture image"
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.1,
          });

          if (photo?.base64 && targetId && mountedRef.current) {
            console.log(`[MOBILE] EMITTING frame to ${targetId}`);
            socketService.emit("video:frame", {
              toUserId: targetId,
              fromUserId: String(user.id),
              conversationId,
              frame: "data:image/jpeg;base64," + photo.base64
            });
          }
        } catch (e) {
          console.log("[MOBILE] Capture error:", e);
        }

        if (mountedRef.current) {
          streamIntervalRef.current = setTimeout(run, 600); // Slower to be safe
        }
      };

      // Give camera 1.5s to warm up
      streamIntervalRef.current = setTimeout(run, 1500);
    };

    const startAudioCapture = async () => {
      if (!mountedRef.current) return;
      if (audioLoopStartedRef.current) return;
      audioLoopStartedRef.current = true;

      const permissionResponse = await Audio.requestPermissionsAsync();
      if (!permissionResponse.granted) {
        console.log("[MOBILE] Microphone permission denied");
        audioLoopStartedRef.current = false;
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const runAudio = async () => {
        if (!mountedRef.current) return;
        if (
          globalAudioRecordingOwner &&
          globalAudioRecordingOwner !== callOwnerKeyRef.current
        ) {
          audioIntervalRef.current = setTimeout(runAudio, 200);
          return;
        }
        if (audioChunkInFlightRef.current) {
          audioIntervalRef.current = setTimeout(runAudio, 120);
          return;
        }

        globalAudioRecordingOwner = callOwnerKeyRef.current;
        audioChunkInFlightRef.current = true;
        try {
          const targetId = isCaller ? toUserId : fromUserId;

          if (audioRecordingRef.current) {
            try {
              await audioRecordingRef.current.stopAndUnloadAsync();
            } catch {}
            audioRecordingRef.current = null;
          }

          const recording = new Audio.Recording();
          audioRecordingRef.current = recording;
          
          await recording.prepareToRecordAsync({
             android: {
               extension: '.m4a',
               outputFormat: 2, // MPEG_4
               audioEncoder: 3, // AAC
               sampleRate: 44100,
               numberOfChannels: 1,
               bitRate: 64000,
             },
             ios: {
               extension: '.m4a',
               audioQuality: 0, // Low
               sampleRate: 44100,
               numberOfChannels: 1,
               bitRate: 64000,
               linearPCMBitDepth: 16,
               linearPCMIsBigEndian: false,
               linearPCMIsFloat: false,
             },
             web: {} as any
          });
          
          await recording.startAsync();
          
          // Record for 1.2s
          await new Promise(resolve => setTimeout(resolve, 1200));

          if (mountedRef.current && audioRecordingRef.current === recording) {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            if (uri && targetId) {
                const base64 = await FileSystem.readAsStringAsync(uri, {
                   encoding: FileSystem.EncodingType.Base64
                });
                
                socketService.emit("video:audio-frame", {
                  toUserId: targetId,
                  fromUserId: String(user.id),
                  conversationId,
                  audio: "data:audio/mp4;codecs=mp4a.40.2;base64," + base64,
                  audioMimeType: "audio/mp4;codecs=mp4a.40.2",
                });
            }
            audioRecordingRef.current = null;
          }
        } catch (e) {
          console.log("[MOBILE] Audio recording error:", e);
          if (audioRecordingRef.current) {
            try {
              await audioRecordingRef.current.stopAndUnloadAsync();
            } catch {}
            audioRecordingRef.current = null;
          }
        } finally {
          audioChunkInFlightRef.current = false;
        }

        if (mountedRef.current) {
          audioIntervalRef.current = setTimeout(runAudio, 160);
        }
      };

      runAudio();
    };

    // Bind listeners first to avoid missing very-fast "answered/frame" events.
    socket.on("video:call-answered", handleAnswered);
    socket.on("video:call-rejected", handleRejected);
    socket.on("video:call-ended", handleEnded);
    socket.on("video:frame", handleVideoFrame);
    socket.on("video:audio-frame", handleAudioFrame);

    // Emit initial signals
    if (!hasEmittedInitialSignal.current) {
      hasEmittedInitialSignal.current = true;
      if (isCaller && toUserId) {
        socketService.emit("video:call-user", {
          fromUserId: String(user.id),
          toUserId,
          conversationId,
          callerName: user.fullName || "Nguoi dung",
          callerAvatar: user.avatarUrl || null,
          callType,
        });
      } else if (autoAccept && fromUserId) {
        socketService.emit("video:answer-call", {
          toUserId: fromUserId,
          fromUserId: String(user.id),
          conversationId,
        });
      }
    }

    if (callState === "accepted") {
      startCaptureLoop();
      startAudioCapture();
    }

    return () => {
      mountedRef.current = false;
      cleanupMedia();
      socket.off("video:call-answered", handleAnswered);
      socket.off("video:call-rejected", handleRejected);
      socket.off("video:call-ended", handleEnded);
      socket.off("video:frame", handleVideoFrame);
      socket.off("video:audio-frame", handleAudioFrame);
    };
  }, [isCaller, toUserId, fromUserId, callType, conversationId, user?.id, callState]);

  const acceptCall = () => {
    socketService.emit("video:answer-call", {
      toUserId: fromUserId,
      fromUserId: String(user?.id || ""),
      conversationId,
    });
    setCallState("accepted");
    setIsRemoteAccepted(false);
  };

  const rejectCall = () => {
    const targetId = isCaller ? toUserId : fromUserId;
    if (targetId) {
      socketService.emit("video:reject-call", {
        toUserId: targetId,
        fromUserId: String(user?.id || ""),
        conversationId,
      });
    }
    endCallLocal(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#111827" }}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />

      {/* RENDER VIDEO OR AVATAR */}
      {callType === "video" && callState === "accepted" ? (
         <View style={{ flex: 1 }}>
            {remoteFrame ? (
               <Image source={{ uri: remoteFrame }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />
            ) : (
               <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: "#fff" }}>Đang chờ đối tác...</Text>
               </View>
            )}

            {permission?.granted && (
               <View style={{ position: "absolute", top: insets.top + 20, right: 20, width: 100, height: 150, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "#374151" }}>
                  <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
               </View>
            )}
         </View>
      ) : (
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
                  : "Dang ket noi..."
                : isCaller
                  ? "Dang goi..."
                  : "Cuoc goi den..."}
          </Text>
        </View>
      )}

      {/* CONTROLS */}
      <View style={{ position: "absolute", bottom: insets.bottom + 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32 }}>
        {callState === "ringing" && !isCaller && (
          <TouchableOpacity
            onPress={acceptCall}
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#22c55e", justifyContent: "center", alignItems: "center" }}
          >
            <Ionicons name="call" size={32} color="#fff" />
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
      </View>
    </View>
  );
}

