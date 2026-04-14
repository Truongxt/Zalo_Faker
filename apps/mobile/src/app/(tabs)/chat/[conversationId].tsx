import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Image,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ImageBackground,
  Modal,
} from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";
import { userService, groupService } from "@/services";
import { socketService } from "@/lib/socket";
import { Avatar } from "@/components/ui/Avatar";
import { ChatOptionsModal } from "@/components/chat/ChatOptionsModal";
import { ForwardMessageModal } from "@/components/chat/ForwardMessageModal";
import { GrayToast } from "@/components/ui";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
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

  if (!res.ok) {
     const errorData = await res.json().catch(() => ({}));
     const msg = errorData.error ? `${errorData.message}: ${errorData.error}` : (errorData.message || "Upload thất bại");
     throw new Error(msg);
  }
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

const normalizeContent = (rawContent: any) => {
  if (typeof rawContent === "string") {
    if (rawContent.startsWith("http")) {
      return { mediaUrl: rawContent, text: "" };
    }
    return { text: rawContent };
  }
  if (!rawContent || typeof rawContent !== "object") {
    return {};
  }
  return {
    text: rawContent.text || rawContent.message || rawContent.content,
    mediaUrl: rawContent.mediaUrl || rawContent.url || rawContent.fileUrl,
    fileName: rawContent.fileName,
    fileSize: rawContent.fileSize,
    duration: rawContent.duration,
  };
};

const handleOpenFile = async (url: string) => {
  if (!url) return;
  try {
    let finalUrl = url;
    const isDoc = /\.(docx|doc|xls|xlsx|ppt|pptx|pdf)$/i.test(url);
    
    // For documents, use Google Docs Viewer for a better preview experience
    if (isDoc) {
      finalUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
    }

    const supported = await Linking.canOpenURL(finalUrl);
    if (supported) {
      await Linking.openURL(finalUrl);
    } else {
      await Linking.openURL(finalUrl);
    }
  } catch (err) {
    console.error("Linking error:", err);
    // If Google Docs Viewer fails, try original URL
    try {
       await Linking.openURL(url);
    } catch {
       Alert.alert("Lỗi", "Không thể mở file. Hãy đảm bảo bạn có ứng dụng hỗ trợ định dạng này.");
    }
  }
};

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
};

function VoiceMessagePlayer({
  audioUrl,
  durationSeconds,
  textColor,
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
      onPress={togglePlayPause}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minWidth: 180,
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

      <Text style={{ color: textColor, fontSize: 12 }}>
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
  allMessages: Message[];
  isMe: boolean;
  onLongPress: (msg: Message) => void;
  onSwipeReply: (msg: Message) => void;
  onReactClick: (msg: Message) => void;
};

function MessageItem({ msg, allMessages, isMe, onLongPress, onSwipeReply, onReactClick }: MessageItemProps) {
  const bg = isMe ? "#0068FF" : "#fff"; // White for received like Zalo
  const isImportant = !!msg.metadata?.isImportant;
  const isForwarded = !!msg.metadata?.isForwarded;
  const textColor = isImportant ? "#111827" : (isMe ? "#fff" : "#111827");
  
  const repliedMsg = msg.replyTo ? allMessages.find(m => m.id === msg.replyTo) : null;

  const renderContent = () => {
    if (msg.isDeleted) {
      return (
        <Text
          style={{ color: isMe ? "#cce4ff" : "#9CA3AF", fontStyle: "italic" }}
        >
          Tin nhắn đã bị thu hồi
        </Text>
      );
    }

    const content = normalizeContent(msg.content);
    const voiceAttachment = (msg.attachments || []).find(
      (a) => a.type === "voice",
    );
    const voiceUrl = content.mediaUrl || voiceAttachment?.url;
    const voiceDuration = content.duration || voiceAttachment?.duration;

    switch (msg.type) {
      case "image":
        return (
          <Image
            source={{ uri: content.mediaUrl || (msg as any).attachments?.[0]?.url }}
            style={{ width: 220, height: 160, borderRadius: 12 }}
            resizeMode="cover"
          />
        );
      case "voice":
        if (voiceUrl) {
          return (
            <VoiceMessagePlayer
              audioUrl={voiceUrl}
              durationSeconds={voiceDuration}
              textColor={textColor}
            />
          );
        }
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="mic-off" size={18} color={textColor} />
            <Text style={{ color: textColor }}>
              Tin nhắn thoại không khả dụng
            </Text>
          </View>
        );
      case "file":
        const fileName = content.fileName || (msg as any).attachments?.[0]?.name || "File đính kèm";
        const fileSize = content.fileSize || (msg as any).attachments?.[0]?.size;
        
        return (
          <TouchableOpacity 
            onPress={() => handleOpenFile(content.mediaUrl)}
            style={{ 
              backgroundColor: "rgba(255,255,255,0.15)",
              padding: 10,
              borderRadius: 12,
              flexDirection: "row", 
              alignItems: "center", 
              gap: 12,
              minWidth: 200,
            }}
          >
            <View style={{ width: 40, height: 40, backgroundColor: "#0068FF", borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
               <Text style={{ color: "#fff", fontWeight: "700", fontSize: 10 }}>
                 {fileName.split(".").pop()?.toUpperCase() || "FILE"}
               </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text 
                style={{ color: textColor, fontWeight: "600", fontSize: 13 }} 
                numberOfLines={1}
              >
                {fileName}
              </Text>
              {fileSize && (
                <Text style={{ color: textColor, opacity: 0.7, fontSize: 11 }}>
                  {(fileSize / 1024).toFixed(1)} KB
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      case "sticker":
        return (
          <Image
            source={{ uri: content.mediaUrl || (typeof msg.content === 'string' ? msg.content : '') }}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
        );
      default:
        return (
          <Text style={{ color: textColor, lineHeight: 20 }}>
            {content.text || ""}
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
    <Swipeable
      renderRightActions={isMe ? undefined : () => null}
      renderLeftActions={isMe ? () => null : undefined}
      onSwipeableWillOpen={() => onSwipeReply(msg)}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: isMe ? "flex-end" : "flex-start",
          marginHorizontal: 12,
          marginVertical: 3,
          alignItems: "flex-end", // Align icons to bottom of bubble
          gap: 6
        }}
      >
        {!isMe && (
          <Avatar
            name={msg.senderName || "?"}
            uri={(msg as any).senderAvatar}
            size={32}
          />
        )}

        {isMe && !msg.isDeleted && (
          <TouchableOpacity 
            onPress={() => onReactClick(msg)}
            style={{ 
              padding: 6,
              backgroundColor: "#fff",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#F3F4F6",
              marginBottom: 10,
            }}
          >
            <Ionicons name="happy-outline" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onLongPress={() => onLongPress(msg)}
          activeOpacity={0.8}
          style={{ maxWidth: "72%", marginLeft: isMe ? 0 : 4 }}
        >
          {!isMe && (
            <Text
              style={{
                fontSize: 11,
                color: "#6B7280",
                marginBottom: 2,
                marginLeft: 4,
              }}
            >
              {msg.senderName}
            </Text>
          )}

          <View
            style={{
              backgroundColor: isImportant ? "#FFF9C4" : bg,
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: isImportant ? 2 : (isMe ? 0 : 1),
              borderColor: isImportant ? "#FFD54F" : "#E5E7EB",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: isImportant ? 4 : 0 },
              shadowOpacity: isImportant ? 0.1 : 0,
              elevation: isImportant ? 2 : 0,
            }}
          >
            {repliedMsg && !msg.isDeleted && (
               <View style={{ 
                 backgroundColor: isMe ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.05)",
                 padding: 8,
                 borderRadius: 10,
                 borderLeftWidth: 3,
                 borderLeftColor: isMe ? "#fff" : "#0068FF",
                 marginBottom: 6,
                 minWidth: 120
               }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isMe ? "#fff" : "#0068FF" }}>
                    {repliedMsg.senderName}
                  </Text>
                  <Text style={{ fontSize: 13, color: isMe ? "#fff" : "#4B5563" }} numberOfLines={1}>
                    {repliedMsg.isDeleted ? "Tin nhắn đã bị thu hồi" : (repliedMsg.content?.text || (repliedMsg.type === 'image' ? '[Hình ảnh]' : '[File]'))}
                  </Text>
               </View>
            )}
            {isForwarded && (
               <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, opacity: 0.8 }}>
                  <Ionicons 
                    name="share-social-outline" 
                    size={12} 
                    color={isImportant ? "#F59E0B" : (isMe ? "#fff" : "#6B7280")} 
                  />
                  <Text 
                    style={{ 
                      fontSize: 10, 
                      color: isImportant ? "#F59E0B" : (isMe ? "#fff" : "#6B7280"), 
                      fontStyle: 'italic', 
                      marginLeft: 4 
                    }}
                  >
                    Tin nhắn này đã được chuyển tiếp
                  </Text>
               </View>
            )}
            {renderContent()}
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: isMe ? "flex-end" : "flex-start",
              gap: 6,
              marginTop: 2,
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
        </TouchableOpacity>

        {!isMe && !msg.isDeleted && (
          <TouchableOpacity 
            onPress={() => onReactClick(msg)}
            style={{ 
              padding: 6,
              backgroundColor: "#fff",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#F3F4F6",
              marginBottom: 10,
            }}
          >
            <Ionicons name="happy-outline" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </Swipeable>
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
  const [importantMode, setImportantMode] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
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
  const repliedMessage = replyTo ? convMessages.find(m => m.id === replyTo) : null;

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
    if (val.trim() && isRecording) {
      handleCancelRecording();
    }
  };

  const handleStartRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Lỗi", "Cần quyền truy cập micro để ghi âm");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimer.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const handleStopAndSendRecording = async () => {
    if (!recording) return;

    try {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) return;

      const duration = recordingTime;
      setRecording(null);
      setRecordingTime(0);

      setIsSending(true);
      const audioUrl = await uploadFile(
        uri,
        `voice_${Date.now()}.m4a`,
        "audio/m4a",
        accessToken
      );

      const metadata = { isImportant: importantMode };
      const voiceMsg: Message = {
        id: `temp-voice-${Date.now()}`,
        conversationId: convId,
        senderId: user?.id || "",
        type: "voice",
        content: { mediaUrl: audioUrl, duration },
        metadata,
        reactions: [],
        readBy: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addMessage(convId, voiceMsg);
      await chatService.sendMessage(convId, {
        type: "voice",
        content: { mediaUrl: audioUrl, duration },
        metadata,
      });
      setImportantMode(false);
    } catch (err) {
      console.error("Failed to stop recording", err);
      Alert.alert("Lỗi", "Không thể gửi tin nhắn thoại");
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelRecording = async () => {
    if (!recording) return;
    try {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setRecordingTime(0);
    } catch (err) {
      console.error("Failed to cancel recording", err);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    try {
      await chatService.addReaction(convId, msgId, emoji);
      setShowReactions(false);
    } catch {
      GrayToast("Không thể thả cảm xúc");
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
      await chatService.sendMessage(convId, { 
        type: "text", 
        content: trimmed,
        replyTo: replyTo || undefined,
        metadata: { isImportant: importantMode } 
      });
      setImportantMode(false);
      setReplyTo(null);
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
        content: { mediaUrl: url, text: "" },
        metadata: { isImportant: importantMode }
      });
      setImportantMode(false);
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
      await chatService.sendMessage(convId, { 
        type: "file", 
        content: { mediaUrl: url, fileName: asset.name, fileSize: asset.size },
        metadata: { isImportant: importantMode }
      });
      setImportantMode(false);
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

    if (conversation?.type === "group") {
      options.push({
        text: "Ghim tin nhắn",
        onPress: () => handlePin(msg),
      });
    }

    if (!msg.isDeleted) {
      options.push({
        text: "Trả lời",
        onPress: () => {
           setReplyTo(msg.id);
        },
      });
      options.push({
        text: "Chuyển tiếp",
        onPress: () => setShowForward(true),
      });
    }

    options.push({ text: "Hủy", style: "cancel" });
    Alert.alert("Tùy chọn", undefined, options);
  };

  const handlePin = async (msg: Message) => {
    if (!convId) return;
    try {
      await groupService.pinGroupMessage(convId, msg.id);
      updateConversation(convId, {
        groupSettings: {
          ...conversation?.groupSettings,
          pinnedMessage: {
            messageId: msg.id,
            senderId: msg.senderId,
            type: msg.type,
            content: msg.content,
            pinnedAt: new Date().toISOString(),
            pinnedBy: user?.id || "",
          } as any,
        } as any,
      });
      GrayToast("Đã ghim tin nhắn");
    } catch (e) {
      GrayToast("Không thể ghim tin nhắn");
    }
  };

  const handleUnpin = async () => {
    if (!convId) return;
    try {
      await groupService.unpinGroupMessage(convId);
      updateConversation(convId, {
        groupSettings: {
          ...conversation?.groupSettings,
          pinnedMessage: null,
        } as any,
      });
      GrayToast("Đã bỏ ghim");
    } catch (e) {
      GrayToast("Không thể bỏ ghim");
    }
  };


  const renderMessage = ({ item }: { item: Message }) => (
    <MessageItem
      msg={item}
      allMessages={convMessages}
      isMe={item.senderId === user?.id}
      onLongPress={handleLongPress}
      onSwipeReply={(m) => setReplyTo(m.id)}
      onReactClick={(m) => {
        setSelectedMsg(m);
        setShowReactions(true);
      }}
    />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ImageBackgroundWrapper background={conversation?.background}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "transparent" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
      {/* Header */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingTop: insets.top,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingBottom: 10,
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

        <Avatar name={convName} uri={convAvatar} size={38} />

        <View style={{ flex: 1, marginLeft: 10 }}>
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
          style={{ padding: 6 }}
          onPress={() => startCall("audio")}
          disabled={conversation?.type === "group"}
        >
          <Ionicons name="call-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ padding: 6 }}
          onPress={() => startCall("video")}
          disabled={conversation?.type === "group"}
        >
          <Ionicons name="videocam-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 6 }} onPress={() => setOptionsVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Pinned Message */}
      {conversation?.groupSettings?.pinnedMessage && (
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Tuỳ chọn", "Bỏ ghim tin nhắn này?", [
              { text: "Bỏ qua" },
              { text: "Bỏ ghim", onPress: handleUnpin, style: "destructive" },
            ]);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#EFF6FF",
            padding: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#DBEAFE",
          }}
        >
          <Ionicons name="pin" size={16} color="#2563EB" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#1D4ED8", fontWeight: "600" }}>
              Tin nhắn ghim
            </Text>
            <Text style={{ fontSize: 13, color: "#1E3A8A" }} numberOfLines={1}>
              {conversation.groupSettings.pinnedMessage?.content?.text ||  conversation.groupSettings.pinnedMessage?.content || "[File/Hình ảnh]"}
            </Text>
          </View>
        </TouchableOpacity>
      )}

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
          contentContainerStyle={{ paddingVertical: 10, paddingBottom: 4 }}
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

      {/* Reaction picker overlay */}
      {showReactions && selectedMsg && (
        <View style={{ 
          position: 'absolute', 
          bottom: 100, // Float above input
          left: 20, 
          right: 20, 
          alignItems: 'center',
          zIndex: 9999
        }}>
           <View
            style={{
              flexDirection: "row",
              backgroundColor: "#fff",
              borderRadius: 40,
              paddingHorizontal: 16,
              paddingVertical: 10,
              gap: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 15,
              elevation: 8,
              alignItems: 'center'
            }}
          >
            {["👍", "❤️", "😂", "😮", "😢", "😡"].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => handleReact(selectedMsg.id, emoji)}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ width: 1, height: 24, backgroundColor: '#F3F4F6' }} />
            <TouchableOpacity onPress={() => setShowReactions(false)}>
              <Ionicons name="close-circle-outline" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Action Icons Row */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#fff",
              borderRadius: 20,
              marginTop: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
              gap: 32,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 4,
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.05)',
            }}
          >
             <TouchableOpacity onPress={() => {
                setShowReactions(false);
                if (selectedMsg) {
                   socketService.emit("chat:recall", {
                      conversationId: convId,
                      messageId: selectedMsg.id,
                      senderId: user?.id,
                    });
                    chatService.deleteMessage(convId, selectedMsg.id);
                }
             }}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
             </TouchableOpacity>

             <TouchableOpacity onPress={() => setShowReactions(false)}>
                <Ionicons name="happy-outline" size={22} color="#4B5563" />
             </TouchableOpacity>

             <TouchableOpacity onPress={() => {
                setShowReactions(false);
                setShowForward(true);
             }}>
                <Ionicons name="share-outline" size={22} color="#4B5563" />
             </TouchableOpacity>

             <TouchableOpacity onPress={() => {
                setShowReactions(false);
                if (selectedMsg) setReplyTo(selectedMsg.id);
             }}>
                <Ionicons name="return-up-back-outline" size={22} color="#4B5563" />
             </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 4, height: 30, backgroundColor: '#0068FF', borderRadius: 2, marginRight: 8 }} />
          <View style={{ flex: 1 }}>
             <Text style={{ fontSize: 11, fontWeight: '700', color: '#0068FF' }}>Trả lời {repliedMessage?.senderName || "tin nhắn"}</Text>
             <Text style={{ fontSize: 13, color: '#4B5563' }} numberOfLines={1}>
                {repliedMessage?.content?.text || (repliedMessage?.type === 'image' ? '[Hình ảnh]' : (repliedMessage?.type === 'video' ? '[Video]' : '[File]'))}
             </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
             <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input area */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          paddingHorizontal: 8,
          paddingVertical: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
          gap: 4,
        }}
      >
        {!isRecording && (
          <>
            <TouchableOpacity onPress={handlePickImage} style={{ padding: 6 }}>
              <Ionicons name="image-outline" size={24} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickFile} style={{ padding: 6 }}>
              <Ionicons name="attach-outline" size={24} color="#6B7280" />
            </TouchableOpacity>
          </>
        )}

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#F3F4F6",
            borderRadius: 20,
            paddingHorizontal: 12,
            minHeight: 40,
            borderWidth: importantMode ? 1.5 : 0,
            borderColor: importantMode ? "#F59E0B" : "transparent",
          }}
        >
          {isRecording ? (
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", marginRight: 8 }} />
                <Text style={{ fontSize: 15, color: "#111827" }}>
                  {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelRecording}>
                <Text style={{ color: "#EF4444", fontWeight: "500" }}>Hủy</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                value={text}
                onChangeText={handleTextChange}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor="#9CA3AF"
                multiline
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  fontSize: 15,
                  color: "#111827",
                  maxHeight: 120,
                }}
              />
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TouchableOpacity onPress={() => setImportantMode(!importantMode)}>
                  <Ionicons 
                    name={importantMode ? "star" : "star-outline"} 
                    size={20} 
                    color={importantMode ? "#F59E0B" : "#6B7280"} 
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEmojiPickerVisible(true)}>
                  <Ionicons name="happy-outline" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {(!text.trim() && !isRecording) ? (
          <TouchableOpacity
            onPress={handleStartRecording}
            style={{
              backgroundColor: "#0068FF",
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="mic-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={isRecording ? handleStopAndSendRecording : handleSend}
            disabled={isSending}
            style={{
              backgroundColor: !isSending ? "#0068FF" : "#D1D5DB",
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
              <Ionicons name={isRecording ? "checkmark" : "send"} size={isRecording ? 24 : 18} color="#fff" />
            )}
          </TouchableOpacity>
        ) }
      </View>
        {conversation && (
           <ChatOptionsModal
             visible={optionsVisible}
             onClose={() => setOptionsVisible(false)}
             conversation={conversation}
           />
        )}

        < EmojiPickerModal 
           visible={emojiPickerVisible}
           onClose={() => setEmojiPickerVisible(false)}
           onSelect={(emoji) => {
             setText((prev) => prev + emoji);
             setEmojiPickerVisible(false);
           }}
        />

        <ForwardMessageModal
           visible={showForward}
           onClose={() => setShowForward(false)}
           message={selectedMsg}
        />
      </KeyboardAvoidingView>
    </ImageBackgroundWrapper>
    </GestureHandlerRootView>
  );
}

function ImageBackgroundWrapper({ background, children }: { background?: string, children: any }) {
  if (background && background.startsWith("http")) {
    return <ImageBackground source={{ uri: background }} style={{ flex: 1 }} resizeMode="cover">{children}</ImageBackground>;
  }
  return <View style={{ flex: 1, backgroundColor: background || "#F9FAFB" }}>{children}</View>;
}

function EmojiPickerModal({ visible, onClose, onSelect, title }: { visible: boolean, onClose: () => void, onSelect: (emoji: string) => void, title?: string }) {
  const emojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🙏", "🔥", "✨", "🎉", "💯", "✅", "❌", "❓", "❗", "🤝", "💪", "🚀", "🌈", "🎈", "🎂", "☕", "🍕", "🍔"];
  const insets = useSafeAreaInsets();
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity 
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }} 
        activeOpacity={1} 
        onPress={onClose} 
      >
        <View style={{ marginTop: "auto", backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
          <View style={{ width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginVertical: 12 }} />
          <View style={{ paddingHorizontal: 16 }}>
             <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 16 }}>{title || "Chọn biểu tượng"}</Text>
             <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
                {emojis.map((emoji) => (
                  <TouchableOpacity 
                    key={emoji} 
                    onPress={() => onSelect(emoji)} 
                    style={{ width: 50, height: 50, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6", borderRadius: 12 }}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
             </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
