import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio, Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";
import { userService } from "@/services";
import { socketService } from "@/lib/socket";
import { Avatar } from "@/components/ui/Avatar";
import { GrayToast } from "@/components/ui";
import type { Message } from "@/types";
import { API_URL } from "@/constants/config";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

/** Upload a single file (image / document / voice) to server */
async function uploadFile(
  uri: string,
  name: string,
  mimeType: string,
  accessToken: string | null,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", { uri, name, type: mimeType } as any);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });

  if (!res.ok) throw new Error("Upload thất bại");
  const data = await res.json();
  return data.url as string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatAudioTime(millis: number) {
  const totalSeconds = Math.max(0, Math.floor((millis || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getPresenceLabel(
  isOnline: boolean,
  lastSeenAt: string | null,
): string {
  if (isOnline) return "Đang hoạt động";
  if (!lastSeenAt) return "Đang offline";

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "Đang offline";

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Vừa truy cập";
  if (diffMinutes < 60) return `Hoạt động ${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  return `Hoạt động ${diffDays} ngày trước`;
}

type VoiceMessagePlayerProps = {
  audioUrl: string;
  durationSeconds?: number;
  textColor: string;
  onPressMessage?: () => void;
};

function VoiceMessagePlayer({
  audioUrl,
  durationSeconds,
  textColor,
  onPressMessage,
}: VoiceMessagePlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(
    durationSeconds && durationSeconds > 0 ? durationSeconds * 1000 : 0,
  );
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        sound.unloadAsync().catch(() => null);
      }
    };
  }, []);

  const updateStatus = useCallback((status: AVPlaybackStatus) => {
    if (!mountedRef.current) return;

    if (!status.isLoaded) {
      if ((status as any).error) {
        setHasError(true);
        setIsLoading(false);
      }
      return;
    }

    setHasError(false);
    setIsPlaying(Boolean(status.isPlaying));
    setPositionMillis(status.positionMillis || 0);
    if (
      typeof status.durationMillis === "number" &&
      status.durationMillis > 0
    ) {
      setDurationMillis(status.durationMillis);
    }
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
    }
  }, []);

  const ensureLoadedSound = useCallback(async () => {
    if (soundRef.current) return soundRef.current;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    const sound = new Audio.Sound();
    sound.setOnPlaybackStatusUpdate(updateStatus);
    await sound.loadAsync(
      { uri: audioUrl },
      { shouldPlay: false, progressUpdateIntervalMillis: 200 },
    );
    soundRef.current = sound;
    return sound;
  }, [audioUrl, updateStatus]);

  const togglePlayPause = useCallback(async () => {
    if (isLoading || hasError) return;

    try {
      setIsLoading(true);
      const sound = await ensureLoadedSound();
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        setHasError(true);
        return;
      }

      if (status.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Khong the phat tin nhan thoai:", error);
      setHasError(true);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [ensureLoadedSound, hasError, isLoading]);

  const progress =
    durationMillis > 0 ? (positionMillis / durationMillis) * 100 : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        onPressMessage?.();
        void togglePlayPause();
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "rgba(255,255,255,0.25)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={16}
            color={textColor}
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: "rgba(255,255,255,0.35)",
          }}
        >
          <View
            style={{
              width: `${Math.max(0, Math.min(progress, 100))}%`,
              height: 4,
              borderRadius: 2,
              backgroundColor: textColor,
            }}
          />
        </View>
      </View>

      <Text
        style={{
          color: textColor,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {formatAudioTime(positionMillis)} / {formatAudioTime(durationMillis)}
      </Text>

      {hasError ? (
        <Ionicons name="warning-outline" size={14} color={textColor} />
      ) : null}
    </TouchableOpacity>
  );
}

type MessageItemProps = {
  msg: Message;
  isMe: boolean;
  isGroupedWithPrevious?: boolean;
  onLongPress: (msg: Message) => void;
};

function MessageItem({
  msg,
  isMe,
  isGroupedWithPrevious = false,
  onLongPress,
}: MessageItemProps) {
  const [showVoiceTranscript, setShowVoiceTranscript] = useState(false);
  const bg = isMe ? "#0068FF" : "#F3F4F6";
  const textColor = isMe ? "#fff" : "#111827";
  const showSenderMeta = !isMe && !isGroupedWithPrevious;
  const voiceAttachment = (msg.attachments || []).find(
    (attachment) => attachment.type === "voice",
  );
  const videoAttachment = (msg.attachments || []).find(
    (attachment) => attachment.type === "video",
  );
  const fallbackVoiceUrl =
    typeof msg.content === "string" && /^https?:\/\//i.test(msg.content)
      ? msg.content
      : undefined;
  const fallbackVideoUrl =
    typeof msg.content === "string" && /^https?:\/\//i.test(msg.content)
      ? msg.content
      : undefined;
  const voiceUrl = voiceAttachment?.url || fallbackVoiceUrl;
  const videoUrl = videoAttachment?.url || fallbackVideoUrl;
  const voiceDuration = voiceAttachment?.duration;
  const transcriptFromContent =
    typeof msg.content === "string" &&
    msg.content.trim() &&
    !/^https?:\/\//i.test(msg.content) &&
    msg.content !== "Tin nhan thoai"
      ? msg.content.trim()
      : "";
  const voiceTranscript =
    voiceAttachment?.transcript ||
    ((msg as any)?.metadata?.transcript as string | undefined) ||
    transcriptFromContent;
  const transcriptStatus = String(
    ((msg as any)?.metadata?.transcriptStatus as string | undefined) || "",
  ).toLowerCase();
  const resolvedTranscript = voiceTranscript?.trim() || "";
  const transcriptLabel = resolvedTranscript
    ? resolvedTranscript
    : transcriptStatus === "failed"
      ? "He thong chua tach duoc text. Dang thu lai o lan tai tiep theo."
      : transcriptStatus === "disabled"
        ? "Tinh nang tach text dang tat tren server."
        : transcriptStatus === "missing_audio_url"
          ? "Khong tim thay file ghi am de tach text."
          : transcriptStatus === "empty"
            ? "Khong nhan dien duoc noi dung tu file ghi am nay."
            : "Dang xu ly tach text cho doan ghi am...";

  const renderContent = () => {
    if (msg.isDeleted) {
      return (
        <Text
          style={{ color: isMe ? "#cce4ff" : "#9CA3AF", fontStyle: "italic" }}
        >
          Tin nhan da bi thu hoi
        </Text>
      );
    }

    switch (msg.type) {
      case "image":
        return (
          <Image
            source={{ uri: (msg as any).attachments?.[0]?.url || msg.content }}
            style={{ width: 200, height: 150, borderRadius: 12 }}
            resizeMode="cover"
          />
        );
      case "video":
        if (!videoUrl) {
          return (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons
                name="videocam-off-outline"
                size={18}
                color={textColor}
              />
              <Text style={{ color: textColor }}>
                Video (khong co duong dan)
              </Text>
            </View>
          );
        }

        return (
          <Video
            source={{ uri: videoUrl }}
            style={{
              width: 230,
              height: 300,
              borderRadius: 12,
              backgroundColor: "#000",
            }}
            useNativeControls
            shouldPlay
            isLooping
            resizeMode={ResizeMode.CONTAIN}
            onError={(error) => {
              console.error("Khong the phat video:", error);
            }}
          />
        );
      case "voice":
        if (voiceUrl) {
          return (
            <View style={{ minWidth: 210 }}>
              <VoiceMessagePlayer
                audioUrl={voiceUrl}
                durationSeconds={voiceDuration}
                textColor={textColor}
                onPressMessage={() => setShowVoiceTranscript(true)}
              />

              <View
                style={{
                  marginTop: 6,
                  alignItems: "flex-end",
                }}
              >
                <TouchableOpacity
                  onPress={() => setShowVoiceTranscript((prev) => !prev)}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 8,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isMe
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(17,24,39,0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 3,
                  }}
                >
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    Text
                  </Text>
                  <Ionicons
                    name={showVoiceTranscript ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={textColor}
                  />
                </TouchableOpacity>
              </View>

              {showVoiceTranscript && (
                <View
                  style={{
                    marginTop: 8,
                    paddingTop: 6,
                    borderTopWidth: 1,
                    borderTopColor: isMe
                      ? "rgba(255,255,255,0.26)"
                      : "rgba(17,24,39,0.14)",
                  }}
                >
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {transcriptLabel}
                  </Text>
                </View>
              )}
            </View>
          );
        }
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="mic-off" size={18} color={textColor} />
            <Text style={{ color: textColor }}>
              Tin nhan thoai (khong co duong dan)
            </Text>
          </View>
        );
      case "file":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="document-outline" size={18} color={textColor} />
            <Text style={{ color: textColor, flex: 1 }} numberOfLines={1}>
              {(msg as any).attachments?.[0]?.name || "File dinh kem"}
            </Text>
          </View>
        );
      case "sticker":
        return (
          <Image
            source={{ uri: msg.content }}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
        );
      default:
        return (
          <Text style={{ color: textColor, lineHeight: 20 }}>
            {msg.content}
          </Text>
        );
    }
  };

  const topReactions = (msg.reactions || []).reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(msg)}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        justifyContent: isMe ? "flex-end" : "flex-start",
        marginHorizontal: 10,
        marginVertical: isGroupedWithPrevious ? 1 : 2,
      }}
    >
      {showSenderMeta && (
        <Avatar
          name={msg.senderName || "?"}
          uri={(msg as any).senderAvatar}
          size={32}
        />
      )}

      <View
        style={{
          maxWidth: "74%",
          marginLeft: isMe ? 0 : showSenderMeta ? 8 : 40,
        }}
      >
        {showSenderMeta && (
          <Text
            style={{
              fontSize: 11,
              color: "#6B7280",
              marginBottom: 1,
              marginLeft: 4,
            }}
          >
            {msg.senderName}
          </Text>
        )}

        <View
          style={{
            backgroundColor: bg,
            borderRadius: 18,
            paddingHorizontal: 11,
            paddingVertical: 7,
          }}
        >
          {renderContent()}
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: isMe ? "flex-end" : "flex-start",
            gap: 6,
            marginTop: 1,
          }}
        >
          <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
            {formatTime(msg.createdAt)}
          </Text>
          {Object.keys(topReactions).length > 0 && (
            <View style={{ flexDirection: "row" }}>
              {Object.entries(topReactions).map(([emoji, count]) => (
                <Text key={emoji} style={{ fontSize: 11 }}>
                  {emoji}
                  {count > 1 ? count : ""}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatRoomScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuthStore();

  const { messages, conversations, addMessage, updateConversation } =
    useChatStore();
  const convId = conversationId || "";
  const convMessages: Message[] = (messages as any)[convId] || [];
  const conversation = conversations.find((c) => c.id === convId);

  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeenAt, setPartnerLastSeenAt] = useState<string | null>(
    null,
  );
  const [presenceTick, setPresenceTick] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Determine conversation name
  const otherParticipant = conversation?.participants?.find(
    (p) => p.userId !== user?.id,
  );
  const convName =
    conversation?.type === "group"
      ? conversation.name || "Nhóm chat"
      : otherParticipant?.fullName || "Người dùng";
  const convAvatar =
    conversation?.type === "group"
      ? conversation.avatarUrl
      : otherParticipant?.avatarUrl;

  const presenceLabel =
    conversation?.type === "private"
      ? getPresenceLabel(isPartnerOnline, partnerLastSeenAt)
      : "";

  // Re-render presence label every minute so "X phút trước" updates naturally.
  useEffect(() => {
    const interval = setInterval(() => {
      setPresenceTick((prev) => prev + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!otherParticipant?.userId || conversation?.type !== "private") return;

    const partnerId = String(otherParticipant.userId);

    const fetchInitialPresence = async () => {
      try {
        const profile = await userService.getUserById(partnerId);
        setPartnerLastSeenAt(profile?.lastSeen || null);
      } catch (error) {
        console.warn("Khong the tai thong tin online cua doi phuong:", error);
      }
    };

    fetchInitialPresence();

    if (!socketService.getSocket()?.connected) {
      socketService.connect();
    }

    socketService.emit(
      "presence:get_online_users",
      [partnerId],
      (response: {
        success: boolean;
        onlineStatuses?: Record<string, boolean>;
      }) => {
        const online = response?.onlineStatuses?.[partnerId];
        if (typeof online !== "boolean") {
          setIsPartnerOnline(false);
          return;
        }
        setIsPartnerOnline(online);
        if (!online) {
          setPartnerLastSeenAt((prev) => prev || new Date().toISOString());
        }
      },
    );

    const handlePresenceOnline = ({ userId }: { userId: string }) => {
      if (String(userId) !== partnerId) return;
      setIsPartnerOnline(true);
      setPartnerLastSeenAt(null);
    };

    const handlePresenceOffline = ({ userId }: { userId: string }) => {
      if (String(userId) !== partnerId) return;
      setIsPartnerOnline(false);
      setPartnerLastSeenAt(new Date().toISOString());
    };

    socketService.on("presence:online", handlePresenceOnline);
    socketService.on("presence:offline", handlePresenceOffline);

    return () => {
      socketService.off("presence:online", handlePresenceOnline);
      socketService.off("presence:offline", handlePresenceOffline);
    };
  }, [conversation?.type, otherParticipant?.userId]);

  const startCall = useCallback(
    (callType: "audio" | "video") => {
      if (!user?.id || !convId || !otherParticipant?.userId) {
        GrayToast("Khong the bat dau cuoc goi");
        return;
      }

      const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      router.push({
        pathname: "/call/[callId]",
        params: {
          callId,
          callType,
          conversationId: convId,
          fromUserId: String(user.id),
          toUserId: String(otherParticipant.userId),
          toUserName: otherParticipant.fullName || "Nguoi dung",
          toUserAvatar: otherParticipant.avatarUrl || "",
          callerName: user.fullName || "Nguoi dung",
          callerAvatar: user.avatarUrl || "",
          isCaller: "true",
        },
      });
    },
    [
      convId,
      otherParticipant?.avatarUrl,
      otherParticipant?.fullName,
      otherParticipant?.userId,
      router,
      user?.avatarUrl,
      user?.fullName,
      user?.id,
    ],
  );

  // Load messages on mount
  useEffect(() => {
    if (!convId) return;
    const load = async () => {
      setIsLoading(true);
      await chatService.loadMessages(convId);
      setIsLoading(false);
    };
    load();
  }, [convId]);

  // Join socket room + listeners
  useEffect(() => {
    if (!convId || !user) return;

    const socket = socketService.connect();
    if (!socket) return;

    socketService.joinRoom(convId);

    const onTyping = ({ userId, conversationId: cId }: any) => {
      if (cId !== convId || userId === user.id) return;
      setTypingUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId],
      );
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUsers([]), 3000);
    };

    const onStopTyping = ({ userId }: any) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    socket.on("chat:typing", onTyping);
    socket.on("chat:stop_typing", onStopTyping);

    return () => {
      socketService.leaveRoom(convId);
      socket.off("chat:typing", onTyping);
      socket.off("chat:stop_typing", onStopTyping);
    };
  }, [convId, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (convMessages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        100,
      );
    }
  }, [convMessages.length]);

  const handleTextChange = (val: string) => {
    setText(val);
    if (convId && user) {
      socketService.emit("chat:typing", { conversationId: convId });
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText("");
    setIsSending(true);
    if (convId && user) {
      socketService.emit("chat:stop_typing", { conversationId: convId });
    }
    try {
      await chatService.sendMessage(convId, { type: "text", content: trimmed });
    } catch {
      GrayToast("Không thể gửi tin nhắn");
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Hãy cấp quyền truy cập ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const name =
      asset.fileName || `media-${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
    const mimeType = asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");

    setIsSending(true);
    try {
      const url = await uploadFile(asset.uri, name, mimeType, accessToken);
      await chatService.sendMessage(convId, {
        type: isVideo ? "video" : "image",
        content: url,
      });
    } catch {
      GrayToast("Không thể gửi ảnh/video");
    } finally {
      setIsSending(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setIsSending(true);
      const url = await uploadFile(
        asset.uri,
        asset.name,
        asset.mimeType || "application/octet-stream",
        accessToken,
      );
      await chatService.sendMessage(convId, { type: "file", content: url });
    } catch {
      GrayToast("Không thể gửi file");
    } finally {
      setIsSending(false);
    }
  };

  const handleLongPress = (msg: Message) => {
    setSelectedMsg(msg);
    const isMe = msg.senderId === user?.id;

    const options: Array<{
      text: string;
      onPress?: () => void;
      style?: "destructive" | "cancel";
    }> = [
      {
        text: "Thả cảm xúc",
        onPress: () => setShowReactions(true),
      },
    ];

    if (isMe && !msg.isDeleted) {
      options.push({
        text: "Thu hồi tin nhắn",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Thu hồi?",
            "Tin nhắn sẽ bị thu hồi với tất cả thành viên.",
            [
              { text: "Hủy", style: "cancel" },
              {
                text: "Thu hồi",
                style: "destructive",
                onPress: () => {
                  socketService.emit("chat:recall", {
                    conversationId: convId,
                    messageId: msg.id,
                    senderId: user?.id,
                  });
                  chatService.deleteMessage(convId, msg.id);
                },
              },
            ],
          );
        },
      });
    }

    options.push({ text: "Hủy", style: "cancel" });
    Alert.alert("Tùy chọn", undefined, options);
  };

  const handleReact = async (emoji: string) => {
    setShowReactions(false);
    if (!selectedMsg) return;
    await chatService.addReaction(convId, selectedMsg.id, emoji);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const previousMessage = index > 0 ? convMessages[index - 1] : null;
    const isGroupedWithPrevious =
      Boolean(previousMessage) &&
      previousMessage!.senderId === item.senderId &&
      !previousMessage!.isDeleted &&
      !item.isDeleted;

    return (
      <MessageItem
        msg={item}
        isMe={item.senderId === user?.id}
        isGroupedWithPrevious={isGroupedWithPrevious}
        onLongPress={handleLongPress}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingTop: 5,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 4, marginRight: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Avatar name={convName} uri={convAvatar} size={36} />

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text
            style={{ fontWeight: "700", fontSize: 15, color: "#111827" }}
            numberOfLines={1}
          >
            {convName}
          </Text>
          {typingUsers.length > 0 && (
            <Text style={{ fontSize: 11, color: "#0068FF" }}>Đang nhập...</Text>
          )}
          {typingUsers.length === 0 && conversation?.type === "private" && (
            <Text
              style={{
                fontSize: 11,
                color: isPartnerOnline ? "#16A34A" : "#6B7280",
              }}
            >
              {presenceLabel}
            </Text>
          )}
          {conversation?.type === "group" && (
            <Text style={{ fontSize: 11, color: "#6B7280" }}>
              {conversation.participants?.length || 0} thành viên
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={{ padding: 4 }}
          onPress={() => startCall("audio")}
          disabled={conversation?.type === "group"}
        >
          <Ionicons name="call-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ padding: 4 }}
          onPress={() => startCall("video")}
          disabled={conversation?.type === "group"}
        >
          <Ionicons name="videocam-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ padding: 4 }}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/chat/conversation-info",
              params: { conversationId: String(convId) },
            })
          }
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#0068FF" />
          <Text style={{ marginTop: 12, color: "#9CA3AF" }}>
            Đang tải tin nhắn...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={convMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 4, paddingBottom: 2 }}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 80,
              }}
            >
              <Text style={{ fontSize: 36, marginBottom: 8 }}>💬</Text>
              <Text style={{ color: "#9CA3AF" }}>
                Hãy bắt đầu cuộc trò chuyện!
              </Text>
            </View>
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

      {/* Reaction picker */}
      {showReactions && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#fff",
            borderRadius: 24,
            marginHorizontal: 16,
            marginBottom: 8,
            padding: 8,
            gap: 8,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleReact(emoji)}
              style={{ padding: 4 }}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowReactions(false)}
            style={{ padding: 4 }}
          >
            <Ionicons name="close-circle-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input area */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          backgroundColor: "#fff",
          paddingHorizontal: 6,
          paddingVertical: 5,
          paddingBottom: Math.max(insets.bottom, 4),
          marginBottom: Platform.OS === "android" ? 0 : 5,
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
          gap: 3,
        }}
      >
        <TouchableOpacity onPress={handlePickImage} style={{ padding: 6 }}>
          <Ionicons name="image-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickFile} style={{ padding: 6 }}>
          <Ionicons name="attach-outline" size={24} color="#6B7280" />
        </TouchableOpacity>

        <TextInput
          value={text}
          onChangeText={handleTextChange}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#9CA3AF"
          multiline
          style={{
            flex: 1,
            backgroundColor: "#F3F4F6",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 7,
            fontSize: 15,
            color: "#111827",
            maxHeight: 120,
          }}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || isSending}
          style={{
            backgroundColor: text.trim() && !isSending ? "#0068FF" : "#D1D5DB",
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
