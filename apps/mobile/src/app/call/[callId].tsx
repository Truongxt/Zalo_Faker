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
import { groupCallInviteStore } from "@/lib/groupCallInviteStore";
import { Avatar } from "@/components/ui/Avatar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

type CallType = "video" | "audio";
type CallState = "ringing" | "accepted" | "ended";
type CallNotice = { id: string; text: string };
let globalAudioRecordingOwner: string | null = null;

const extractMimeTypeFromDataUrl = (value: string): string => {
  if (!value?.startsWith("data:")) return "";
  const endIndex = value.indexOf(";base64,");
  if (endIndex <= 5) return "";
  return value.slice(5, endIndex).toLowerCase();
};

const extensionFromMimeType = (mimeType: string): string => {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a") || mimeType.includes("aac")) return "m4a";
  return "m4a";
};

const extensionFromBase64Header = (base64Data: string): string | null => {
  const header = String(base64Data || "").slice(0, 32);
  if (header.startsWith("UklGR")) return "wav"; // RIFF
  if (header.startsWith("GkXf")) return "webm"; // Matroska/WebM
  if (header.startsWith("AAAAFGZ0eX") || header.startsWith("AAAAIGZ0eX")) return "m4a"; // ftyp
  if (header.startsWith("T2dnUw")) return "ogg"; // OggS
  return null;
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

  const isGroupCall = String(params.isGroupCall) === "true";
  const roomIdParam = String(params.roomId || "");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(roomIdParam || null);
  const [callState, setCallState] = useState<CallState>(autoAccept ? "accepted" : "ringing");
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);
  const [remoteFrames, setRemoteFrames] = useState<Record<string, string>>({});
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [isLocalVideoOff, setIsLocalVideoOff] = useState(false);
  const [notices, setNotices] = useState<CallNotice[]>([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef<any>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRecordingRef = useRef<Audio.Recording | null>(null);
  const audioLoopStartedRef = useRef(false);
  const audioChunkInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const hasEmittedInitialSignal = useRef(false);
  const isLocalMutedRef = useRef(false);
  const isLocalVideoOffRef = useRef(false);
  const noticeIdRef = useRef(0);
  const participantNamesRef = useRef<Record<string, string>>({});

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

  useEffect(() => {
    isLocalMutedRef.current = isLocalMuted;
  }, [isLocalMuted]);

  useEffect(() => {
    isLocalVideoOffRef.current = isLocalVideoOff;
  }, [isLocalVideoOff]);

  useEffect(() => {
    participantNamesRef.current = participantNames;
  }, [participantNames]);

  const pushNotice = (text: string) => {
    const id = `notice-${Date.now()}-${noticeIdRef.current++}`;
    setNotices((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setNotices((prev) => prev.filter((item) => item.id !== id));
    }, 2500);
  };

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
      if (isGroupCall) {
        // Leave the group call room if we have a roomId
        if (activeRoomId) {
          socketService.emit("group:leave", { roomId: activeRoomId }, () => {});
        }
        socketService.emit("video:leave-call", {
          fromUserId: String(user?.id || ""),
          conversationId,
          isGroupCall: true,
        });
      } else {
        const targetId = isCaller ? toUserId : fromUserId;
        if (targetId) {
          socketService.emit("video:end-call", {
            toUserId: targetId,
            fromUserId: String(user?.id || ""),
            conversationId,
            isGroupCall: false,
          });
        }
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

    if (isGroupCall && activeRoomId && (isCaller || callState === "accepted")) {
      socket.emit("group:join", { roomId: activeRoomId });
    }

    const handleAnswered = (data: any) => {
      if (!isGroupCall && (!isCaller || String(data?.toUserId || "") !== String(user.id))) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      setCallState("accepted");
      setIsRemoteAccepted(true);
    };

    const handleRejected = (data: any) => {
      if (!isGroupCall && String(data?.toUserId || "") !== String(user.id)) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      Alert.alert("Cuộc gọi bị từ chối", "Đầu bên kia đã từ chối cuộc gọi", [
        { text: "Đóng", onPress: () => endCallLocal(false) },
      ]);
    };

    const handleEnded = (data: any) => {
      if (!isGroupCall && String(data?.toUserId || "") !== String(user.id)) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      Alert.alert("Kết thúc", "Cuộc gọi đã kết thúc", [
        { text: "Đóng", onPress: () => endCallLocal(false) },
      ]);
    };

    const handleUserLeft = (data: any) => {
      if (String(data?.conversationId || "") !== conversationId) return;
      const leftUserId = String(data?.fromUserId || "");
      if (leftUserId) {
         setRemoteFrames((prev) => {
            const next = { ...prev };
            delete next[leftUserId];
            return next;
         });
      }
    };

    const handleVideoFrame = (data: any) => {
      if (!mountedRef.current) return;
      
      const incomingConvId = String(data?.conversationId || "");
      if (incomingConvId !== conversationId) return;
      
      if (callState !== "accepted") {
        setCallState("accepted");
      }
      setIsRemoteAccepted(true);
      if (data.frame && data.fromUserId) {
        setRemoteFrames((prev) => ({
           ...prev,
           [data.fromUserId]: data.frame,
        }));
      }
    };

    const handleAudioFrame = async (data: any) => {
      if (!mountedRef.current) return;
      if (String(data?.conversationId || "") !== conversationId) return;
      if (!isGroupCall) {
        const expectedRemoteUserId = isCaller ? toUserId : fromUserId;
        const incomingUserId = String(data?.fromUserId || "");
        if (incomingUserId && incomingUserId !== expectedRemoteUserId) return;
      }

      if (data.audio) {
        if (callState !== "accepted") {
          setCallState("accepted");
        }
        setIsRemoteAccepted(true);
        console.log("[Mobile] Received audio frame from", data.fromUserId);
        try {
          const audioPayload = String(data.audio);
          const mimeFromPayload = extractMimeTypeFromDataUrl(audioPayload);
          const fallbackMime = String(data?.audioMimeType || "").toLowerCase();
          const mimeType = mimeFromPayload || fallbackMime || "audio/mp4";

          let base64Data = audioPayload;
          if (base64Data.includes("base64,")) {
            base64Data = base64Data.split("base64,")[1];
          }

          const extension = extensionFromBase64Header(base64Data) || extensionFromMimeType(mimeType);
          console.log("[Mobile] Audio chunk mime/ext:", mimeType, extension, "len=", base64Data.length);
          const fileUri = `${FileSystem.cacheDirectory}remote_audio_${Date.now()}.${extension}`;
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: true,
          });

          const { sound } = await Audio.Sound.createAsync(
            { uri: fileUri },
            { shouldPlay: true, volume: 1.0, androidImplementation: "MediaPlayer" }
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
        if (isLocalVideoOffRef.current) {
          streamIntervalRef.current = setTimeout(run, 600);
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

          if (photo?.base64 && mountedRef.current && (isGroupCall || targetId)) {
            console.log(`[MOBILE] EMITTING frame to ${isGroupCall ? 'group' : targetId}`);
            socketService.emit("video:frame", {
              toUserId: isGroupCall ? undefined : targetId,
              fromUserId: String(user.id),
              conversationId,
              frame: "data:image/jpeg;base64," + photo.base64,
              isGroupCall,
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
        if (isLocalMutedRef.current) {
          audioIntervalRef.current = setTimeout(runAudio, 200);
          return;
        }
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
            if (uri && (isGroupCall || targetId)) {
                const base64 = await FileSystem.readAsStringAsync(uri, {
                   encoding: FileSystem.EncodingType.Base64
                });
                
                socketService.emit("video:audio-frame", {
                  toUserId: isGroupCall ? undefined : targetId,
                  fromUserId: String(user.id),
                  conversationId,
                  audio: "data:audio/mp4;codecs=mp4a.40.2;base64," + base64,
                  audioMimeType: "audio/mp4;codecs=mp4a.40.2",
                  isGroupCall,
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
    socket.on("video:user-left", handleUserLeft);
    socket.on("video:frame", handleVideoFrame);
    socket.on("video:audio-frame", handleAudioFrame);

    // Group call participant tracking (new events from server)
    const handleGroupUserJoined = (data: any) => {
      if (!isGroupCall) return;
      if (data?.userId && data?.userName) {
        setParticipantNames((prev) => ({ ...prev, [data.userId]: data.userName }));
        if (String(data.userId) !== String(user?.id || "")) {
          pushNotice(`${data.userName} da tham gia`);
        }
      }
    };

    const handleGroupUserLeft = (data: any) => {
      if (!isGroupCall) return;
      const leftUserId = String(data?.userId || data?.fromUserId || "");
      if (leftUserId) {
        const leftName =
          participantNames[leftUserId] ||
          String(data?.userName || data?.name || "Nguoi dung");
        setRemoteFrames((prev) => {
          const next = { ...prev };
          delete next[leftUserId];
          return next;
        });
        setParticipantNames((prev) => {
          const next = { ...prev };
          delete next[leftUserId];
          return next;
        });
        if (leftUserId !== String(user?.id || "")) {
          pushNotice(`${leftName} da roi cuoc goi`);
        }
      }
    };

    const handleGroupMediaChanged = (data: any) => {
      if (!isGroupCall) return;
      if (String(data?.roomId || "") !== String(activeRoomId || roomIdParam || "")) return;
      const changedUserId = String(data?.userId || "");
      if (!changedUserId || changedUserId === String(user?.id || "")) return;
      const displayName = participantNamesRef.current[changedUserId] || "Nguoi dung";
      if (typeof data?.isMuted === "boolean") {
        pushNotice(data.isMuted ? `${displayName} da tat mic` : `${displayName} da bat mic`);
      }
      if (typeof data?.isVideoOff === "boolean" && callType === "video") {
        pushNotice(data.isVideoOff ? `${displayName} da tat camera` : `${displayName} da bat camera`);
      }
    };

    socket.on("group:user-joined", handleGroupUserJoined);
    socket.on("group:user-left", handleGroupUserLeft);
    socket.on("group:media-changed", handleGroupMediaChanged);

    // Emit initial signals
    if (!hasEmittedInitialSignal.current) {
      hasEmittedInitialSignal.current = true;
      if (isCaller && (isGroupCall || toUserId)) {
        if (isGroupCall) {
          // Create room on server + auto-invite all conversation members
          socketService.emit("group:create", {
            conversationId,
            callType,
            autoInvite: true,
          }, (res: any) => {
            if (res?.success && res?.room?.roomId) {
              setActiveRoomId(res.room.roomId);
              groupCallInviteStore.remove(conversationId);
              console.log("[Mobile] Created group call room:", res.room.roomId);
            }
          });
        }

        // Always emit legacy event for backward compatibility
        socketService.emit("video:call-user", {
          fromUserId: String(user.id),
          toUserId: isGroupCall ? undefined : toUserId,
          conversationId,
          callerName: user.fullName || "Nguoi dung",
          callerAvatar: user.avatarUrl || null,
          callType,
          isGroupCall,
        });
      } else if (autoAccept && (isGroupCall || fromUserId)) {
        // Join the group room if we have a roomId
        if (isGroupCall && roomIdParam) {
          socketService.emit("group:join", { roomId: roomIdParam }, (res: any) => {
            if (res?.success) {
              setActiveRoomId(roomIdParam);
              groupCallInviteStore.remove(conversationId);
              console.log("[Mobile] Joined group call room:", roomIdParam);
            }
          });
        }

        socketService.emit("video:answer-call", {
          toUserId: isGroupCall ? undefined : fromUserId,
          fromUserId: String(user.id),
          conversationId,
          isGroupCall,
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
      socket.off("video:user-left", handleUserLeft);
      socket.off("video:frame", handleVideoFrame);
      socket.off("video:audio-frame", handleAudioFrame);
      socket.off("group:user-joined", handleGroupUserJoined);
      socket.off("group:user-left", handleGroupUserLeft);
      socket.off("group:media-changed", handleGroupMediaChanged);
    };
  }, [isCaller, toUserId, fromUserId, callType, conversationId, user?.id, callState, activeRoomId, roomIdParam]);

  useEffect(() => {
    if (!conversationId) return;
    socketService.joinRoom(conversationId);
    return () => {
      socketService.leaveRoom(conversationId);
    };
  }, [conversationId]);

  const acceptCall = () => {
    if (isGroupCall && (activeRoomId || roomIdParam)) {
      const joinRoomId = String(activeRoomId || roomIdParam);
      socketService.emit("group:join", { roomId: joinRoomId }, (res: any) => {
        if (res?.success) {
          setActiveRoomId(joinRoomId);
          groupCallInviteStore.remove(conversationId);
        }
      });
    }

    socketService.emit("video:answer-call", {
      toUserId: isGroupCall ? undefined : fromUserId,
      fromUserId: String(user?.id || ""),
      conversationId,
      isGroupCall,
    });
    setCallState("accepted");
    setIsRemoteAccepted(false);
  };

  const rejectCall = () => {
    if (isGroupCall) {
      // For group calls, local reject only: user can still re-join while room exists.
    } else {
      const targetId = isCaller ? toUserId : fromUserId;
      if (targetId) {
        socketService.emit("video:reject-call", {
          toUserId: targetId,
          fromUserId: String(user?.id || ""),
          conversationId,
          isGroupCall: false,
        });
      }
    }
    endCallLocal(false);
  };

  const toggleMute = () => {
    setIsLocalMuted((prev) => {
      const next = !prev;
      const roomId = String(activeRoomId || roomIdParam || "");
      if (isGroupCall && roomId) {
        socketService.emit("group:media-toggle", { roomId, isMuted: next });
      }
      return next;
    });
  };

  const toggleVideo = () => {
    if (callType !== "video") return;
    setIsLocalVideoOff((prev) => {
      const next = !prev;
      const roomId = String(activeRoomId || roomIdParam || "");
      if (isGroupCall && roomId) {
        socketService.emit("group:media-toggle", { roomId, isVideoOff: next });
      }
      return next;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#111827" }}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />

      {/* RENDER VIDEO OR AVATAR */}
      {callType === "video" && callState === "accepted" ? (
         <View style={{ flex: 1, backgroundColor: "#000" }}>
            {isGroupCall ? (
               <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', marginTop: insets.top }}>
                 <View style={{ width: Object.keys(remoteFrames).length > 0 ? '50%' : '100%', height: Object.keys(remoteFrames).length > 1 ? '50%' : '100%', borderWidth: 1, borderColor: '#111827' }}>
                   {permission?.granted && !isLocalVideoOff ? (
                     <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
                   ) : (
                     <View style={{ flex: 1, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#fff' }}>{isLocalVideoOff ? "Da tat camera" : "No Camera"}</Text></View>
                   )}
                   <View style={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                     <Text style={{ color: '#fff', fontSize: 12 }}>Bạn</Text>
                   </View>
                 </View>
                 {Object.entries(remoteFrames).map(([uid, frame]) => (
                   <View key={uid} style={{ width: Object.keys(remoteFrames).length > 0 ? '50%' : '100%', height: Object.keys(remoteFrames).length > 1 ? '50%' : '100%', borderWidth: 1, borderColor: '#111827' }}>
                     <Image source={{ uri: frame }} style={{ flex: 1 }} resizeMode="cover" />
                   </View>
                 ))}
               </View>
            ) : (
              <View style={{ flex: 1 }}>
                {Object.keys(remoteFrames).length > 0 ? (
                   <Image source={{ uri: Object.values(remoteFrames)[0] }} style={{ width: "100%", height: "100%", position: "absolute" }} resizeMode="cover" />
                ) : (
                   <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: "#fff" }}>Đang chờ đối tác...</Text>
                   </View>
                )}

                {permission?.granted && !isLocalVideoOff && (
                   <View style={{ position: "absolute", top: insets.top + 20, right: 20, width: 100, height: 150, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "#374151" }}>
                      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
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

      {notices.length > 0 && (
        <View style={{ position: "absolute", top: insets.top + 16, right: 12, gap: 8 }}>
          {notices.map((notice) => (
            <View key={notice.id} style={{ backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: "#fff", fontSize: 12 }}>{notice.text}</Text>
            </View>
          ))}
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

