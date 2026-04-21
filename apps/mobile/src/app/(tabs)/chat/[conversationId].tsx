import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio, Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import Svg, { Path, Line } from "react-native-svg";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";
import { pinGroupMessage, unpinGroupMessage, renameGroup } from "@/services/groupService";
import { conversationService, friendsService, userService } from "@/services";
import { socketService } from "@/lib/socket";
import { groupCallInviteStore } from "@/lib/groupCallInviteStore";
import { Avatar } from "@/components/ui/Avatar";
import { GrayToast } from "@/components/ui";

import { ChatOptionsModal } from "@/components/chat/ChatOptionsModal";
import { PollMessageCard } from "@/components/chat/PollMessageCard";
import { ForwardMessageModal } from "@/components/chat/ForwardMessageModal";
import { MessageActionModal, type MessageActionItem } from "@/components/chat/MessageActionModal";
import type { Message, PollContent } from "@/types";
import { API_URL } from "@/constants/config";
import { STICKER_URLS } from "@/constants/stickers";

import { addPollOptionMessage, removePollOptionMessage, votePollMessage, uploadFile } from "@/services/chat";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

type FilePreviewTarget = {
  url: string;
  name: string;
  type: "pdf" | "word";
};

const WORD_EXTENSIONS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

const getFileExtension = (fileName: string) => {
  const cleaned = fileName.split("?")[0].split("#")[0];
  const parts = cleaned.split(".");
  if (parts.length < 2) return "";
  return String(parts[parts.length - 1] || "")
    .trim()
    .toLowerCase();
};

const resolveFilePreviewTarget = (msg: Message): FilePreviewTarget | null => {
  if (msg.type !== "file") return null;

  const primaryAttachment = (msg.attachments || []).find(
    (attachment) => attachment.type === "file" && attachment.url,
  );
  const fallbackUrl =
    typeof msg.content === "string" && /^https?:\/\//i.test(msg.content)
      ? msg.content
      : "";

  const url = String(primaryAttachment?.url || fallbackUrl || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const fileName = String(primaryAttachment?.name || url).trim();
  const ext = getFileExtension(fileName || url);

  if (ext === "pdf") {
    return {
      url,
      name: primaryAttachment?.name || "Tài liệu PDF",
      type: "pdf",
    };
  }

  if (WORD_EXTENSIONS.has(ext)) {
    return {
      url,
      name: primaryAttachment?.name || "Tài liệu Word",
      type: "word",
    };
  }

  return null;
};

const getPreviewWebUri = (target: FilePreviewTarget) => {
  if (target.type === "pdf") return target.url;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(target.url)}`;
};

const formatRecordingTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const isImageBackground = (value?: string | null) =>
  Boolean(value && /^(https?:\/\/|data:|blob:|\/)/i.test(value.trim()));

const getFullMediaUrl = (url?: string) => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) {
    const base = API_URL.replace(/\/+$/, "");
    return `${base}${trimmed}`;
  }
  return trimmed;
};

const getSolidBackgroundColor = (value?: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "#F9FAFB";

  if (/^linear-gradient/i.test(normalized)) {
    const colors = normalized.match(/#(?:[0-9a-fA-F]{3}){1,2}/g);
    return colors?.[0] || "#F9FAFB";
  }

  if (/^(#|rgb)/i.test(normalized)) {
    return normalized;
  }

  return "#F9FAFB";
};

const getPinnedMessagePreview = (message: any) => {
  if (!message) return "Tin nhắn đã ghim";

  if (message.type === "poll") {
    const question = String(message.content?.question || "").trim();
    return question ? `[Binh chon] ${question}` : "[Binh chon]";
  }

  if (message.metadata?.isAnnouncement) {
    const announceText = String(message.content?.text || "").trim();
    return announceText ? `[Thông báo] ${announceText}` : "[Thông báo]";
  }

  const content = message.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (content && typeof content === "object") {
    const text = String(
      content.text || content.message || content.content || "",
    ).trim();
    if (text) return text;

    if (typeof content.fileName === "string" && content.fileName.trim()) {
      return `[File] ${content.fileName.trim()}`;
    }
  }

  if (message.type === "image") return "[Hình ảnh]";
  if (message.type === "video") return "[Video]";
  if (message.type === "voice") return "[Tin nhắn thoại]";
  if (message.type === "sticker") return "[Sticker]";
  if (message.type === "file") return "[Tập tin]";
  return "Tin nhắn đã ghim";
};

type ReplyPreview = {
  senderName: string;
  content: string;
};

const getReplyMessageId = (
  replyTo: Message["replyTo"] | string | null | undefined,
) => {
  if (!replyTo) return null;
  if (typeof replyTo === "string") return replyTo;
  if (typeof replyTo === "object" && "id" in replyTo && replyTo.id) {
    return String(replyTo.id);
  }
  return null;
};

const getMessagePreviewText = (message: Message | null | undefined) => {
  if (!message) return "Tin nhắn";
  if (message.isDeleted) return "Tin nhắn đã thu hồi";

  switch (message.type) {
    case "poll":
      return String((message.content as PollContent | undefined)?.question || "").trim()
        ? `[Binh chon] ${String((message.content as PollContent).question).trim()}`
        : "[Binh chon]";
    case "image":
      return "[Hình ảnh]";
    case "video":
      return "[Video]";
    case "voice":
      return "[Tin nhắn thoại]";
    case "sticker":
      return "[Sticker]";
    case "file":
      return (
        String((message as any).attachments?.[0]?.name || "").trim() ||
        "[Tập tin]"
      );
    default: {
      if (typeof message.content === "string" && message.content.trim()) {
        return message.content.trim();
      }

      const nestedText = String(
        (message.content as any)?.text ||
        (message.content as any)?.message ||
        (message.content as any)?.content ||
        "",
      ).trim();

      return nestedText || "Tin nhắn";
    }
  }
};

const resolveReplyPreview = (
  replyTo: Message["replyTo"] | string | null | undefined,
  messages: Message[],
): ReplyPreview | null => {
  if (!replyTo) return null;

  if (
    typeof replyTo === "object" &&
    "content" in replyTo &&
    "senderName" in replyTo &&
    typeof replyTo.content === "string" &&
    replyTo.content.trim()
  ) {
    return {
      senderName: replyTo.senderName || "Người dùng",
      content: replyTo.content.trim(),
    };
  }

  const replyMessageId = getReplyMessageId(replyTo);
  if (!replyMessageId) return null;

  const targetMessage = messages.find(
    (message) => String(message.id) === String(replyMessageId),
  );

  if (!targetMessage) {
    return {
      senderName:
        typeof replyTo === "object" &&
          "senderName" in replyTo &&
          replyTo.senderName
          ? replyTo.senderName
          : "Người dùng",
      content:
        typeof replyTo === "object" && "content" in replyTo && replyTo.content
          ? replyTo.content
          : "Tin nhắn",
    };
  }

  return {
    senderName: targetMessage.senderName || "Người dùng",
    content: getMessagePreviewText(targetMessage),
  };
};



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

type ParsedCallPayload = {
  callType: "audio" | "video";
  status: string;
  duration: number;
};

const normalizeCallType = (
  value: unknown,
): ParsedCallPayload["callType"] | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "audio" || normalized === "voice") return "audio";
  return null;
};

const normalizeCallStatus = (value: unknown): string | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return normalized === "ended" ? "finished" : normalized;
};

const parseCallPayloadFromObject = (
  value: Record<string, unknown>,
): ParsedCallPayload | null => {
  const callType = normalizeCallType(value.callType);
  const status = normalizeCallStatus(value.status || value.callStatus);
  if (!callType || !status) return null;

  const duration =
    typeof value.duration === "number" && Number.isFinite(value.duration)
      ? Math.max(0, Math.floor(value.duration))
      : 0;

  return { callType, status, duration };
};

const parseCallPayload = (value: unknown): ParsedCallPayload | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parseCallPayloadFromObject(parsed as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) return null;
  const objectValue = value as Record<string, unknown>;
  const direct = parseCallPayloadFromObject(objectValue);
  if (direct) return direct;

  const nestedText =
    typeof objectValue.text === "string"
      ? objectValue.text
      : typeof objectValue.message === "string"
        ? objectValue.message
        : typeof objectValue.content === "string"
          ? objectValue.content
          : "";

  return nestedText ? parseCallPayload(nestedText) : null;
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
  onOpenFilePreview: (target: FilePreviewTarget) => void;
  replyPreview?: ReplyPreview | null;
  participants?: Array<{ userId: string; fullName?: string; nickname?: string }>;
  currentUserId?: string | null;
  onVotePoll: (messageId: string, optionIds: string[]) => Promise<void>;
  onAddPollOption: (messageId: string, text: string) => Promise<void>;
  onRemovePollOption: (messageId: string, optionId: string) => Promise<void>;
};

function MessageItem({
  msg,
  isMe,
  isGroupedWithPrevious = false,
  onLongPress,
  onOpenFilePreview,
  replyPreview = null,
  participants = [],
  currentUserId,
  onVotePoll,
  onAddPollOption,
  onRemovePollOption,
}: MessageItemProps) {
  const [showVoiceTranscript, setShowVoiceTranscript] = useState(false);
  const isAnnouncement = Boolean((msg as any)?.metadata?.isAnnouncement);
  
  if (msg.type === 'system' || isAnnouncement) {
    const action = (msg.metadata as any)?.action;
    const isPinAction = action === 'pin' || action === 'unpin';
    
    const getIconName = () => {
      if (action === 'pin' || action === 'unpin') return 'pricetag';
      if (action === 'rename_group') return 'create';
      if (action === 'update_avatar') return 'image';
      if (action === 'add_member') return 'person-add';
      if (action === 'remove_member') return 'person-remove';
      if (action === 'update_permissions') return 'lock-closed';
      if (action === 'update_settings') return 'settings';
      return 'information-circle';
    };

    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 10, width: '100%' }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          gap: 8, 
          paddingHorizontal: 12, 
          paddingVertical: 6, 
          borderRadius: 20, 
          borderWidth: 1, 
          borderColor: '#E2E8F0', 
          backgroundColor: '#FFFFFF',
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
          maxWidth: '92%'
        }}>
          <View style={{ 
            width: 24, 
            height: 24, 
            borderRadius: 12, 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: isPinAction ? '#FFF7ED' : '#EFF6FF' 
          }}>
            <Ionicons name={getIconName() as any} size={12} color={isPinAction ? '#F97316' : '#3B82F6'} />
          </View>
          <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
             {typeof msg.content === 'object' ? (msg.content as any)?.text || '' : String(msg.content || '')}
          </Text>
        </View>
      </View>
    );
  }

  const bg = isAnnouncement ? "#FFF7E6" : isMe ? "#0068FF" : "#F3F4F6";
  const textColor = isAnnouncement ? "#111827" : isMe ? "#fff" : "#111827";
  const showSenderMeta = !isMe && !isGroupedWithPrevious;
  const voiceAttachment = (msg.attachments || []).find(
    (attachment) => attachment.type === "voice",
  );
  const videoAttachment = (msg.attachments || []).find(
    (attachment) => attachment.type === "video",
  );
  const fallbackVoiceUrl =
    typeof msg.content === "string" &&
      (/^https?:\/\//i.test(msg.content) || msg.content.startsWith("/"))
      ? msg.content
      : undefined;
  const contentVoiceUrl =
    msg.content && typeof msg.content === "object"
      ? String(
        (msg.content as any).mediaUrl ||
        (msg.content as any).url ||
        (msg.content as any).fileUrl ||
        "",
      ).trim() || undefined
      : undefined;
  const fallbackVideoUrl =
    typeof msg.content === "string" &&
      (/^https?:\/\//i.test(msg.content) || msg.content.startsWith("/"))
      ? msg.content
      : typeof msg.content === "object"
        ? String(
          (msg.content as any).mediaUrl || (msg.content as any).url || "",
        ).trim() || undefined
        : undefined;

  const voiceUrl = getFullMediaUrl(
    voiceAttachment?.url || contentVoiceUrl || fallbackVoiceUrl,
  );
  const videoUrl = getFullMediaUrl(videoAttachment?.url || fallbackVideoUrl);
  const voiceDuration =
    voiceAttachment?.duration ||
    (typeof (msg.content as any)?.duration === "number"
      ? (msg.content as any).duration
      : undefined);
  const transcriptFromContent =
    typeof msg.content === "string" &&
      msg.content.trim() &&
      !/^https?:\/\//i.test(msg.content) &&
      msg.content !== "Tin nhắn thoại"
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
      ? "Hệ thống chưa tách được text. Đang thử lại ở lần tải tiếp theo."
      : transcriptStatus === "disabled"
        ? "Tính năng tách text đang tắt trên server."
        : transcriptStatus === "missing_audio_url"
          ? "Không tìm thấy file ghi âm để tách text."
          : transcriptStatus === "empty"
            ? "Không nhận diện được nội dung từ file ghi âm này."
            : "Đang xử lý tách text cho đoạn ghi âm...";
  const parsedCallPayload =
    parseCallPayload(msg.content) ||
    (msg.type === "call"
      ? { callType: "audio" as const, status: "finished", duration: 0 }
      : null);
  const isForwarded = Boolean((msg as any)?.metadata?.isForwarded);

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

    if (parsedCallPayload) {
      const isMissed =
        parsedCallPayload.status === "missed" ||
        parsedCallPayload.status === "rejected";
      const callStatusText = (() => {
        const suffix = parsedCallPayload.callType === "video" ? " video" : "";
        if (parsedCallPayload.status === "finished") {
          return isMe ? `Cuộc gọi đi${suffix}` : `Cuộc gọi đến${suffix}`;
        }
        if (parsedCallPayload.status === "missed") {
          return isMe ? "Thuê bao không bắt máy" : `Cuộc gọi nhỡ${suffix}`;
        }
        if (parsedCallPayload.status === "rejected")
          return "Cuộc gọi bị từ chối";
        if (parsedCallPayload.status === "cancelled") return "Cuộc gọi bị hủy";
        return parsedCallPayload.callType === "video"
          ? "Cuộc gọi video"
          : "Cuộc gọi";
      })();

      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isMissed
                ? isMe
                  ? "rgba(255,255,255,0.24)"
                  : "#fee2e2"
                : isMe
                  ? "rgba(255,255,255,0.24)"
                  : "#dbeafe",
            }}
          >
            <Ionicons
              name={
                parsedCallPayload.callType === "video" ? "videocam" : "call"
              }
              size={20}
              color={
                isMissed
                  ? isMe
                    ? "#fff"
                    : "#ef4444"
                  : isMe
                    ? "#fff"
                    : "#3b82f6"
              }
            />
          </View>
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <Text style={{ color: textColor, fontWeight: "700", fontSize: 16 }}>
              {callStatusText}
            </Text>
            {parsedCallPayload.status === "finished" && (
              <Text style={{ color: textColor, opacity: 0.75, fontSize: 13 }}>
                {formatAudioTime(parsedCallPayload.duration * 1000)}
              </Text>
            )}
            {isMissed && !isMe && (
              <Text
                style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}
              >
                Nhấn để gọi lại
              </Text>
            )}
          </View>
        </View>
      );
    }

    switch (msg.type) {
      case "poll":
        return (
          <PollMessageCard
            messageId={msg.id}
            content={msg.content as PollContent}
            currentUserId={currentUserId}
            participants={participants}
            isMe={isMe}
            textColor={textColor}
            onVote={onVotePoll}
            onAddOption={onAddPollOption}
            onRemoveOption={onRemovePollOption}
          />
        );
      case "image":
        return (
          <Image
            source={{ uri: (msg as any).attachments?.[0]?.url || msg.content }}
            style={{ width: 220, height: 165, borderRadius: 14 }}
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
                Video (không có đường dẫn)
              </Text>
            </View>
          );
        }

        return (
          <Video
            source={{ uri: videoUrl }}
            style={{
              width: 240,
              height: 320,
              borderRadius: 14,
              backgroundColor: "#000",
            }}
            useNativeControls
            shouldPlay
            isLooping
            resizeMode={ResizeMode.CONTAIN}
            onError={(error) => {
              console.error("Không thể phát video:", error);
            }}
          />
        );
      case "voice":
        if (voiceUrl) {
          return (
            <View style={{ minWidth: 228 }}>
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
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Text
                  </Text>
                  <Ionicons
                    name={showVoiceTranscript ? "chevron-up" : "chevron-down"}
                    size={15}
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
                      fontSize: 14,
                      lineHeight: 20,
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
              Tin nhắn thoại (không có đường dẫn)
            </Text>
          </View>
        );
      case "file":
        const previewTarget = resolveFilePreviewTarget(msg);
        const hasPreview = Boolean(previewTarget);
        return (
          <View style={{ gap: 8 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Ionicons name="document-outline" size={20} color={textColor} />
              <Text
                style={{ color: textColor, flex: 1, fontSize: 14 }}
                numberOfLines={1}
              >
                {(msg as any).attachments?.[0]?.name || "File đính kèm"}
              </Text>
            </View>

            {hasPreview ? (
              <TouchableOpacity
                onPress={() => onOpenFilePreview(previewTarget!)}
                activeOpacity={0.85}
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isMe ? "rgba(255,255,255,0.35)" : "#9CA3AF",
                  backgroundColor: isMe
                    ? "rgba(255,255,255,0.14)"
                    : "rgba(17,24,39,0.06)",
                }}
              >
                <Text
                  style={{
                    color: textColor,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  Xem trước
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={{
                  color: isMe ? "rgba(255,255,255,0.75)" : "#6B7280",
                  fontSize: 12,
                }}
              >
                File này chưa hỗ trợ xem trước
              </Text>
            )}
          </View>
        );
      case "sticker":
        return (
          <Image
            source={{ uri: msg.content }}
            style={{ width: 112, height: 112 }}
            resizeMode="contain"
          />
        );
      default:
        return (
          <Text style={{ color: textColor, fontSize: 16, lineHeight: 22 }}>
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
        marginHorizontal: 12,
        marginVertical: isGroupedWithPrevious ? 1 : 2,
      }}
    >
      {showSenderMeta && (
        <Avatar
          name={msg.senderName || "?"}
          uri={(msg as any).senderAvatar}
          size={36}
        />
      )}

      <View
        style={{
          maxWidth: "76%",
          marginLeft: isMe ? 0 : showSenderMeta ? 8 : 44,
        }}
      >
        {showSenderMeta && (
          <Text
            style={{
              fontSize: 12,
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
            borderRadius: 20,
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderWidth: isAnnouncement ? 1 : 0,
            borderColor: isAnnouncement ? "#F5C24B" : "transparent",
          }}
        >
          {replyPreview && !msg.isDeleted && (
            <View
              style={{
                marginBottom: 8,
                paddingHorizontal: 11,
                paddingVertical: 9,
                borderRadius: 14,
                backgroundColor: isAnnouncement
                  ? "#FFFDF7"
                  : isMe
                    ? "#EAF2FF"
                    : "#FFFFFF",
                borderWidth: 1,
                borderColor: isAnnouncement
                  ? "#F7D98B"
                  : isMe
                    ? "#9DBDFF"
                    : "#D8E6FF",
              }}
            >
              <Text
                style={{
                  color: "#2563EB",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {replyPreview.senderName}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  marginTop: 3,
                  color: "#64748B",
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                {replyPreview.content}
              </Text>
            </View>
          )}
          {isForwarded && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                marginBottom: 6,
              }}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={13}
                color={isMe ? "rgba(255,255,255,0.85)" : "#6B7280"}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: isMe ? "rgba(255,255,255,0.88)" : "#6B7280",
                }}
              >
                Chuyển tiếp
              </Text>
            </View>
          )}
          {isAnnouncement && (
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: "#FDE9A9",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: "#9A5B00",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                Thông báo
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
  const headerTopPadding =
    Platform.OS === "ios" ? insets.top + 6 : Math.max(insets.top, 10);
  const { user, accessToken } = useAuthStore();

  const { messages, conversations } = useChatStore();
  const convId = conversationId || "";
  const convMessages: Message[] = (messages as any)[convId] || [];
  const conversation = conversations.find((c) => c.id === convId);
  const hasCachedMessages = convMessages.length > 0;

  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessageQuery, setSearchMessageQuery] = useState("");
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [messageActions, setMessageActions] = useState<MessageActionItem[]>([]);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [announcementMode, setAnnouncementMode] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);

  const [isSummarizingConversation, setIsSummarizingConversation] =
    useState(false);
  const [dailySummary, setDailySummary] = useState<{
    conversationName: string;
    summary: string;
    messageCount: number;
    date: string;
  } | null>(null);
  const [previewTarget, setPreviewTarget] = useState<FilePreviewTarget | null>(
    null,
  );
  const [previewError, setPreviewError] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeenAt, setPartnerLastSeenAt] = useState<string | null>(
    null,
  );
  const [presenceTick, setPresenceTick] = useState(0);
  const [blockStatus, setBlockStatus] = useState<
    "none" | "blocked_by_me" | "blocked_by_other"
  >("none");
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceRecordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const pinnedMessageRef = useRef<any>(null);

  useEffect(() => {
    pinnedMessageRef.current = conversation?.groupSettings?.pinnedMessage || null;
  }, [conversation?.groupSettings?.pinnedMessage]);

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
  const isBlockedByMe = blockStatus === "blocked_by_me";
  const isBlockedByOther = blockStatus === "blocked_by_other";
  const isMessagingBlocked =
    conversation?.type === "private" && (isBlockedByMe || isBlockedByOther);
  const myGroupRole = String(
    conversation?.participants?.find(
      (p) => String(p.userId) === String(user?.id),
    )?.role || "member",
  ).toLowerCase();
  const pinScope = String(
    conversation?.groupSettings?.permissions?.pinMessage || "admin_deputy",
  ).toLowerCase();
  const canPinInGroup =
    conversation?.type === "group"
      ? (() => {
        const roleRank: Record<string, number> = {
          member: 1,
          deputy: 2,
          admin: 3,
        };
        const scopeRank: Record<string, number> = {
          all: 1,
          admin_deputy: 2,
          admin: 3,
        };
        const currentRank = roleRank[myGroupRole] || 0;
        const requiredRank = scopeRank[pinScope] || Number.MAX_SAFE_INTEGER;
        return currentRank >= requiredRank;
      })()
      : false;
  const announcementScope = String(
    conversation?.groupSettings?.permissions?.sendAnnouncement ||
    "admin_deputy",
  ).toLowerCase();
  const canSendAnnouncementInGroup =
    conversation?.type === "group"
      ? (() => {
        const roleRank: Record<string, number> = {
          member: 1,
          deputy: 2,
          admin: 3,
        };
        const scopeRank: Record<string, number> = {
          all: 1,
          admin_deputy: 2,
          admin: 3,
        };
        const currentRank = roleRank[myGroupRole] || 0;
        const requiredRank =
          scopeRank[announcementScope] || Number.MAX_SAFE_INTEGER;
        return currentRank >= requiredRank;
      })()
      : false;
  const canPinMessage =
    conversation?.type === "group"
      ? canPinInGroup
      : conversation?.type === "private";
  const pinnedMessage = conversation?.groupSettings?.pinnedMessage || null;
  const filteredMessages = useMemo(() => {
    if (!searchMessageQuery.trim()) return convMessages;
    return convMessages.filter((msg) => {
      const text = String((msg.content as any)?.text || msg.content || "").toLowerCase();
      return text.includes(searchMessageQuery.toLowerCase());
    });
  }, [convMessages, searchMessageQuery]);

  const displayMessages = filteredMessages;
  const activeReplyPreview = replyToMessageId
    ? resolveReplyPreview(replyToMessageId, convMessages)
    : null;
  const conversationBackground = String(conversation?.background || "").trim();
  const usesImageBackground = isImageBackground(conversationBackground);
  const chatAreaBackgroundColor = getSolidBackgroundColor(
    conversationBackground,
  );

  const getPinnedMessagePreview = useCallback((message: any) => {
    if (!message) return "Tin nhắn đã ghim";
    if (message.type === "poll") {
      const question = String(message.content?.question || "").trim();
      return question ? `[Binh chon] ${question}` : "[Binh chon]";
    }
    if (message.metadata?.isAnnouncement) {
      const announceText = String(message.content?.text || "").trim();
      return announceText ? `[Thông báo] ${announceText}` : "[Thông báo]";
    }

    const content = message.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    if (content && typeof content === "object") {
      const text = String(
        content.text || content.message || content.content || "",
      ).trim();
      if (text) return text;
      if (typeof content.fileName === "string" && content.fileName.trim()) {
        return `[File] ${content.fileName.trim()}`;
      }
    }

    if (message.type === "image") return "[Hình ảnh]";
    if (message.type === "video") return "[Video]";
    if (message.type === "voice") return "[Tin nhắn thoại]";
    if (message.type === "sticker") return "[Sticker]";
    if (message.type === "file") return "[Tập tin]";
    return "Tin nhắn đã ghim";
  }, []);

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
        console.warn("Không thể tải thông tin online của đối phương:", error);
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

  useEffect(() => {
    if (
      !user?.id ||
      !otherParticipant?.userId ||
      conversation?.type !== "private"
    ) {
      setBlockStatus("none");
      return;
    }

    let cancelled = false;
    const syncBlockStatus = async () => {
      try {
        const relation = await friendsService.getExitingFriend(
          String(user.id),
          String(otherParticipant.userId),
        );
        if (cancelled) return;

        if (!relation || String((relation as any).status) !== "blocked") {
          setBlockStatus("none");
          return;
        }

        const blockedByMe = String(relation.fromUserId) === String(user.id);
        setBlockStatus(blockedByMe ? "blocked_by_me" : "blocked_by_other");
      } catch {
        if (!cancelled) setBlockStatus("none");
      }
    };

    void syncBlockStatus();
    return () => {
      cancelled = true;
    };
  }, [conversation?.type, otherParticipant?.userId, user?.id]);

  useEffect(() => {
    if (!otherParticipant?.userId || !user?.id) return;

    const handleFriendBlocked = ({
      targetUserId,
    }: {
      targetUserId: string;
    }) => {
      if (String(targetUserId) !== String(otherParticipant.userId)) return;
      setBlockStatus("blocked_by_me");
      GrayToast("Đã chặn người dùng");
    };

    const handleBlockedBy = ({
      blockedByUserId,
    }: {
      blockedByUserId: string;
    }) => {
      if (String(blockedByUserId) !== String(otherParticipant.userId)) return;
      setBlockStatus("blocked_by_other");
      GrayToast("Bạn đã bị chặn");
    };

    const handleFriendUnblocked = ({
      targetUserId,
    }: {
      targetUserId: string;
    }) => {
      if (String(targetUserId) !== String(otherParticipant.userId)) return;
      setBlockStatus("none");
      GrayToast("Đã mở chặn người dùng");
    };

    const handleUnblockedBy = ({
      unblockedByUserId,
    }: {
      unblockedByUserId: string;
    }) => {
      if (String(unblockedByUserId) !== String(otherParticipant.userId)) return;
      setBlockStatus("none");
      GrayToast("Người dùng đã bỏ chặn bạn");
    };

    socketService.on("friend:blocked", handleFriendBlocked);
    socketService.on("friend:blocked_by", handleBlockedBy);
    socketService.on("friend:unblocked", handleFriendUnblocked);
    socketService.on("friend:unblocked_by", handleUnblockedBy);

    return () => {
      socketService.off("friend:blocked", handleFriendBlocked);
      socketService.off("friend:blocked_by", handleBlockedBy);
      socketService.off("friend:unblocked", handleFriendUnblocked);
      socketService.off("friend:unblocked_by", handleUnblockedBy);
    };
  }, [otherParticipant?.userId, user?.id]);

  const resolvePinActorName = useCallback(
    (actorId: string) => {
      const normalizedActorId = String(actorId || "").trim();
      if (!normalizedActorId) return "User";

      if (String(user?.id || "") === normalizedActorId) {
        return String(user?.fullName || "User").trim() || "User";
      }

      const participantName = conversation?.participants?.find(
        (participant) => String(participant.userId) === normalizedActorId,
      )?.fullName;
      if (typeof participantName === "string" && participantName.trim()) {
        return participantName.trim();
      }

      const messageSenderName = convMessages.find(
        (message) => String(message.senderId) === normalizedActorId,
      )?.senderName;
      if (typeof messageSenderName === "string" && messageSenderName.trim()) {
        return messageSenderName.trim();
      }

      return "User";
    },
    [convMessages, conversation?.participants, user?.fullName, user?.id],
  );





  const startCall = useCallback(
    (callType: "audio" | "video") => {
      if (!user?.id || !convId) {
        GrayToast("Không thể bắt đầu cuộc gọi");
        return;
      }

      if (conversation?.type !== "group" && !otherParticipant?.userId) {
        GrayToast("Không thể bắt đầu cuộc gọi");
        return;
      }

      const isGroup = conversation?.type === "group";
      if (isGroup) {
        const activeInvite = groupCallInviteStore.get(String(convId));
        if (activeInvite?.roomId) {
          const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          router.push({
            pathname: "/call/[callId]",
            params: {
              callId,
              callType: activeInvite.callType || callType,
              conversationId: convId,
              fromUserId: String(activeInvite.hostUserId || ""),
              toUserId: String(user.id),
              toUserName: conversation.name || "NhÃ³m",
              toUserAvatar: conversation.avatarUrl || "",
              callerName: activeInvite.callerName || "NgÆ°á»i dÃ¹ng",
              callerAvatar: activeInvite.callerAvatar || "",
              isCaller: "false",
              autoAccept: "true",
              isGroupCall: "true",
              roomId: activeInvite.roomId,
            },
          });
          return;
        }
      }

      const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      router.push({
        pathname: "/call/[callId]",
        params: {
          callId,
          callType,
          conversationId: convId,
          fromUserId: String(user.id),
          toUserId: isGroup ? "" : String(otherParticipant?.userId),
          toUserName: isGroup
            ? conversation.name || "Nhóm"
            : otherParticipant?.fullName || "Người dùng",
          toUserAvatar: isGroup
            ? conversation.avatarUrl || ""
            : otherParticipant?.avatarUrl || "",
          callerName: user.fullName || "Người dùng",
          callerAvatar: user.avatarUrl || "",
          isCaller: "true",
          isGroupCall: isGroup ? "true" : "false",
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
      conversation?.type,
      conversation?.name,
      conversation?.avatarUrl,
    ],
  );

  const handleOpenFilePreview = useCallback((target: FilePreviewTarget) => {
    setPreviewError(false);
    setPreviewTarget(target);
  }, []);

  const handleCloseFilePreview = useCallback(() => {
    setPreviewError(false);
    setPreviewTarget(null);
  }, []);

  const handleOpenFileExternally = useCallback(async () => {
    if (!previewTarget?.url) return;
    try {
      const canOpen = await Linking.canOpenURL(previewTarget.url);
      if (!canOpen) {
        GrayToast("Không mở được file");
        return;
      }
      await Linking.openURL(previewTarget.url);
    } catch {
      GrayToast("Không mở được file");
    }
  }, [previewTarget?.url]);

  // Load messages on mount
  useEffect(() => {
    if (!convId) return;

    let cancelled = false;

    const load = async () => {
      if (hasCachedMessages) {
        setIsLoading(false);
        await chatService.loadMessages(convId).catch(() => null);
        return;
      }

      setIsLoading(true);
      await chatService.loadMessages(convId).catch(() => null);
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [convId, hasCachedMessages]);

  useEffect(() => {
    setShowStickerPicker(false);
    setDailySummary(null);
    setIsSummarizingConversation(false);
    setAnnouncementMode(false);
  }, [convId]);

  useEffect(() => {
    pinnedMessageRef.current = pinnedMessage;
  }, [pinnedMessage]);

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
    if (displayMessages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        100,
      );
    }
  }, [displayMessages.length]);

  useEffect(() => {
    return () => {
      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
        voiceRecordingTimerRef.current = null;
      }

      const recording = voiceRecordingRef.current;
      voiceRecordingRef.current = null;
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => null);
      }
    };
  }, []);

  const handleTextChange = (val: string) => {
    if (isMessagingBlocked) return;
    setText(val);
    if (convId && user) {
      socketService.emit("chat:typing", { conversationId: convId });
    }
  };

  const handleToggleStickerPicker = useCallback(() => {
    if (isMessagingBlocked) {
      GrayToast(
        isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn",
      );
      return;
    }
    setShowStickerPicker((prev) => !prev);
  }, [isBlockedByMe, isMessagingBlocked]);

  const handleSendSticker = useCallback(
    async (stickerUrl: string) => {
      if (!convId || isSending) return;
      if (isMessagingBlocked) {
        GrayToast(
          isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn",
        );
        return;
      }

      setShowStickerPicker(false);
      setIsSending(true);
      if (convId && user) {
        socketService.emit("chat:stop_typing", { conversationId: convId });
      }

      try {
        await chatService.sendMessage(convId, {
          type: "sticker",
          content: stickerUrl,
          replyTo: replyToMessageId || undefined,
        });
        setReplyToMessageId(null);
      } catch {
        GrayToast("Không thể gửi sticker");
      } finally {
        setIsSending(false);
      }
    },
    [
      convId,
      isSending,
      isMessagingBlocked,
      isBlockedByMe,
      replyToMessageId,
      user,
    ],
  );

  const handleToggleVoiceRecording = useCallback(async () => {
    if (!convId || isSending) return;
    if (isMessagingBlocked) {
      GrayToast(
        isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn",
      );
      return;
    }

    if (isRecordingVoice) {
      const recording = voiceRecordingRef.current;
      voiceRecordingRef.current = null;
      setIsRecordingVoice(false);
      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
        voiceRecordingTimerRef.current = null;
      }
      if (!recording) {
        setVoiceRecordingSeconds(0);
        return;
      }

      setIsSending(true);
      if (convId && user) {
        socketService.emit("chat:stop_typing", { conversationId: convId });
      }

      try {
        const statusBeforeStop = await recording
          .getStatusAsync()
          .catch(() => null);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });

        const durationMillis =
          typeof statusBeforeStop?.durationMillis === "number" &&
            Number.isFinite(statusBeforeStop.durationMillis)
            ? statusBeforeStop.durationMillis
            : voiceRecordingSeconds * 1000;

        if (!uri) {
          throw new Error("Missing recorded audio URI");
        }

        const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
        const url = await uploadFile(
          uri,
          `voice_${Date.now()}.m4a`,
          mimeType,
          accessToken,
        );

        await chatService.sendMessage(convId, {
          type: "voice",
          content: {
            mediaUrl: url,
            duration: Math.max(1, Math.round(durationMillis / 1000)),
          },
          replyTo: replyToMessageId || undefined,
        });
        setReplyToMessageId(null);
      } catch (error) {
        console.error("Không thể gửi voice:", error);
        GrayToast("Không thể gửi voice");
      } finally {
        setIsSending(false);
        setVoiceRecordingSeconds(0);
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        GrayToast("Cần cấp quyền micro");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await recording.startAsync();

      voiceRecordingRef.current = recording;
      setVoiceRecordingSeconds(0);
      setIsRecordingVoice(true);

      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
      }
      voiceRecordingTimerRef.current = setInterval(() => {
        setVoiceRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Không thể bật voice:", error);
      voiceRecordingRef.current = null;
      setIsRecordingVoice(false);
      setVoiceRecordingSeconds(0);
      if (voiceRecordingTimerRef.current) {
        clearInterval(voiceRecordingTimerRef.current);
        voiceRecordingTimerRef.current = null;
      }
    }
  }, [
    accessToken,
    convId,
    isBlockedByMe,
    isMessagingBlocked,
    isRecordingVoice,
    isSending,
    replyToMessageId,
    user,
    voiceRecordingSeconds,
  ]);

  const handleCancelVoiceRecording = useCallback(async () => {
    if (!isRecordingVoice) return;

    const recording = voiceRecordingRef.current;
    voiceRecordingRef.current = null;
    setIsRecordingVoice(false);
    setVoiceRecordingSeconds(0);

    if (voiceRecordingTimerRef.current) {
      clearInterval(voiceRecordingTimerRef.current);
      voiceRecordingTimerRef.current = null;
    }

    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.error("Lỗi khi hủy voice:", error);
    }
  }, [isRecordingVoice]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    if (
      conversation?.type === "group" &&
      announcementMode &&
      !canSendAnnouncementInGroup
    ) {
      GrayToast("Bạn không có quyền gửi thông báo trong nhóm này");
      return;
    }
    if (isMessagingBlocked) {
      GrayToast(
        isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn",
      );
      return;
    }
    const nextMetadata =
      conversation?.type === "group" && announcementMode
        ? { isAnnouncement: true }
        : undefined;
    setText("");
    setIsSending(true);
    if (convId && user) {
      socketService.emit("chat:stop_typing", { conversationId: convId });
    }
    try {
      await chatService.sendMessage(convId, {
        type: "text",
        content: trimmed,
        replyTo: replyToMessageId || undefined,
        metadata: nextMetadata,
      });
      setReplyToMessageId(null);
      setAnnouncementMode(false);
    } catch {
      GrayToast("Không thể gửi tin nhắn");
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImage = async () => {
    if (isMessagingBlocked) {
      GrayToast(
        isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn",
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Hãy cấp quyền truy cập ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    setIsSending(true);
    let failedCount = 0;
    let sentCount = 0;

    try {
      for (const [index, asset] of result.assets.entries()) {
        const isVideo = asset.type === "video";
        const name =
          asset.fileName ||
          `media-${Date.now()}-${index}.${isVideo ? "mp4" : "jpg"}`;
        const mimeType =
          asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");

        try {
          const url = await uploadFile(asset.uri, name, mimeType, accessToken);
          await chatService.sendMessage(convId, {
            type: isVideo ? "video" : "image",
            content: url,
            replyTo: replyToMessageId || undefined,
          });
          sentCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (sentCount > 0) {
        setReplyToMessageId(null);
      }

      if (failedCount > 0) {
        if (failedCount === result.assets.length) {
          GrayToast("Không thể gửi ảnh/video");
        } else {
          GrayToast(
            `Đã gửi ${result.assets.length - failedCount}/${result.assets.length} ảnh/video`,
          );
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  const handlePickFile = async () => {
    if (isMessagingBlocked) {
      GrayToast(
        isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn",
      );
      return;
    }
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
        content: url,
        replyTo: replyToMessageId || undefined,
      });
      setReplyToMessageId(null);
    } catch {
      GrayToast("Không thể gửi file");
    } finally {
      setIsSending(false);
    }
  };

  const handleVotePoll = useCallback(
    async (messageId: string, optionIds: string[]) => {
      try {
        const updated = await votePollMessage(messageId, optionIds);
        useChatStore
          .getState()
          .updateMessage(String(updated.conversationId), String(updated.id), updated);
        GrayToast("Đã cập nhật bình chọn");
      } catch (error: any) {
        GrayToast(error?.message || "Không thể cập nhật bình chọn");
        throw error;
      }
    },
    [],
  );

  const handleAddPollOption = useCallback(
    async (messageId: string, text: string) => {
      try {
        const updated = await addPollOptionMessage(messageId, text);
        useChatStore
          .getState()
          .updateMessage(String(updated.conversationId), String(updated.id), updated);
        GrayToast("Đã thêm phương án");
      } catch (error: any) {
        GrayToast(error?.message || "Không thể thêm phương án");
        throw error;
      }
    },
    [],
  );

  const handleRemovePollOption = useCallback(
    async (messageId: string, optionId: string) => {
      try {
        const updated = await removePollOptionMessage(messageId, optionId);
        useChatStore
          .getState()
          .updateMessage(String(updated.conversationId), String(updated.id), updated);
        GrayToast("Đã xóa phương án");
      } catch (error: any) {
        GrayToast(error?.message || "Không thể xóa phương án");
        throw error;
      }
    },
    [],
  );

  const handleOpenMoreActions = useCallback(() => {
    if (conversation?.type === "group") {
      Alert.alert("Tùy chọn", undefined, [
        {
          text: "Tạo bình chọn",
          onPress: () =>
            router.push({
              pathname: "/(tabs)/chat/create-poll",
              params: { conversationId: String(convId) },
            }),
        },
        {
          text: "Gửi file",
          onPress: () => {
            void handlePickFile();
          },
        },
        { text: "Hủy", style: "cancel" },
      ]);
      return;
    }

    void handlePickFile();
  }, [conversation?.type, convId, handlePickFile, router]);

  const handleSummarizeConversationInDay = useCallback(async () => {
    if (!convId || isSummarizingConversation) return;

    try {
      setIsSummarizingConversation(true);
      const result = await conversationService.getDailySummary(convId, {
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      });

      setDailySummary({
        conversationName: result.conversationName || convName,
        summary: result.summary,
        messageCount: result.messageCount,
        date: result.date,
      });

      GrayToast(
        result.messageCount > 0
          ? "Đã tạo tóm tắt cuộc trò chuyện trong ngày"
          : "Không có tin nhắn trong ngày để tóm tắt",
      );
    } catch (error) {
      console.error("Không thể tóm tắt cuộc trò chuyện:", error);
      GrayToast("Không thể tóm tắt cuộc trò chuyện lúc này");
    } finally {
      setIsSummarizingConversation(false);
    }
  }, [convId, convName, isSummarizingConversation]);

  const handleUpdatePinnedMessage = useCallback(
    (nextPinnedMessage: any | null) => {
      if (!conversation) return;

      const fallbackSettings = {
        invite: {
          code: conversation.groupSettings?.invite?.code || "",
          approvalRequired:
            conversation.groupSettings?.invite?.approvalRequired ?? true,
        },
        permissions: {
          sendMedia:
            conversation.groupSettings?.permissions?.sendMedia || "all",
          pinMessage:
            conversation.groupSettings?.permissions?.pinMessage ||
            (conversation.type === "group" ? "admin_deputy" : "all"),
          sendAnnouncement:
            conversation.groupSettings?.permissions?.sendAnnouncement ||
            (conversation.type === "group" ? "admin_deputy" : "all"),
        },
        pinnedMessage: null,
      };

      useChatStore.getState().updateConversation(convId, {
        groupSettings: {
          ...(conversation.groupSettings || fallbackSettings),
          pinnedMessage: nextPinnedMessage,
        },
      });
    },
    [convId, conversation],
  );

  useEffect(() => {
    if (!convId || !user) return;

    const socket = socketService.getSocket() || socketService.connect();
    if (!socket) return;

    const onPinnedMessage = ({
      conversationId: incomingConversationId,
      pinnedMessage: nextPinnedMessage,
      updatedBy,
    }: {
      conversationId: string;
      pinnedMessage: any | null;
      updatedBy?: string;
    }) => {
      if (String(incomingConversationId) !== String(convId)) return;
      // void appendPinnedHistory(nextPinnedMessage || null, updatedBy);
      handleUpdatePinnedMessage(nextPinnedMessage || null);
    };

    socket.on("chat:pinned_message", onPinnedMessage);

    const onUpdateConversation = ({
      id: incomingId,
      ...updates
    }: {
      id: string;
      [key: string]: any;
    }) => {
      if (String(incomingId) !== String(convId)) return;

      if (updates && Object.keys(updates).length > 0) {
        useChatStore.getState().updateConversation(convId, updates);
      }
    };

    socket.on("chat:update_conversation", onUpdateConversation);

    return () => {
      socket.off("chat:pinned_message", onPinnedMessage);
      socket.off("chat:update_conversation", onUpdateConversation);
    };
  }, [convId, handleUpdatePinnedMessage, user]);

  const handlePinMessage = useCallback(
    async (message: Message) => {
      if (!convId || !conversation) return;

      if (message.isDeleted) {
        GrayToast("Không thể ghim tin nhắn đã thu hồi");
        return;
      }

      try {
        if (conversation.type === "group") {
          if (!canPinInGroup) {
            GrayToast("Bạn không có quyền ghim tin nhắn trong nhóm này");
            return;
          }
        }

        const result =
          conversation.type === "group"
            ? await pinGroupMessage(convId, message.id)
            : await conversationService.pinMessage(convId, message.id);

        const nextPinned =
          (result as any)?.pinnedMessage ||
          (result as any)?.conversation?.groupSettings?.pinnedMessage ||
          (result as any)?.group?.groupSettings?.pinnedMessage ||
          null;
        // await appendPinnedHistory(nextPinned, user?.id);
        handleUpdatePinnedMessage(nextPinned);

        GrayToast("Đã ghim tin nhắn");
      } catch (error: any) {
        GrayToast(error?.message || "Không thể ghim tin nhắn");
      }
    },
    [
      canPinInGroup,
      convId,
      conversation,
      handleUpdatePinnedMessage,
      user?.id,
    ],
  );

  const handleUnpinMessage = useCallback(async () => {
    if (!convId || !conversation) return;

    try {
      if (conversation.type === "group") {
        if (!canPinInGroup) {
          GrayToast("Bạn không có quyền bỏ ghim tin nhắn trong nhóm này");
          return;
        }
        await unpinGroupMessage(convId);
      } else {
        await conversationService.unpinMessage(convId);
      }

      // Record history BEFORE state update so previousPinnedMessage is still available
      // await appendPinnedHistory(null, user?.id);
      // Delay state update to allow socket listener to use old pinnedMessageRef
      setTimeout(() => {
        handleUpdatePinnedMessage(null);
      }, 100);

      GrayToast("Đã bỏ ghim tin nhắn");
    } catch (error: any) {
      GrayToast(error?.message || "Không thể bỏ ghim tin nhắn");
    }
  }, [
    canPinInGroup,
    convId,
    conversation,
    handleUpdatePinnedMessage,
    user?.id,
  ]);

  const handleLongPress = (msg: Message) => {
    setSelectedMsg(msg);
    const isMe = msg.senderId === user?.id;
    const isPinnedMessage = Boolean(
      pinnedMessage && String(pinnedMessage.messageId) === String(msg.id),
    );

    const options: MessageActionItem[] = [
        {
          key: "react",
          text: "Thả cảm xúc",
          onPress: () => setShowReactions(true),
        },
      ];

    if (isMe && !msg.isDeleted) {
      options.push({
        key: "recall",
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

    if (!msg.isDeleted && canPinMessage) {
      options.push({
        key: isPinnedMessage ? "unpin" : "pin",
        text: isPinnedMessage ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn",
        onPress: () => {
          if (isPinnedMessage) {
            void handleUnpinMessage();
            return;
          }
          void handlePinMessage(msg);
        },
      });
    }

    if (!msg.isDeleted) {
      options.push({
        key: "reply",
        text: "Trả lời",
        onPress: () => setReplyToMessageId(msg.id),
      });
      options.push({
        key: "forward",
        text: "Chuyển tiếp",
        onPress: () => setForwardMessage(msg),
      });
    }

    options.push({ key: "cancel", text: "Hủy", style: "cancel" });
    setMessageActions(options);
    setShowMessageActions(true);
  };

  const handleReact = async (emoji: string) => {
    setShowReactions(false);
    if (!selectedMsg) return;
    await chatService.addReaction(convId, selectedMsg.id, emoji);
  };

  const handleBlockUser = () => {
    if (conversation?.type !== "private" || !otherParticipant?.userId) return;

    const partnerId = String(otherParticipant.userId);
    const partnerName = otherParticipant.fullName || "người dùng";

    Alert.alert(
      "Chặn người dùng",
      `Bạn có chắc muốn chặn ${partnerName}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chặn",
          style: "destructive",
          onPress: async () => {
            try {
              await friendsService.blockUser(partnerId);
              setBlockStatus("blocked_by_me");
              GrayToast("Đã chặn người dùng");
            } catch {
              GrayToast("Không thể chặn người dùng");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleUnblockUser = () => {
    if (conversation?.type !== "private" || !otherParticipant?.userId) return;

    const partnerId = String(otherParticipant.userId);
    const partnerName = otherParticipant.fullName || "người dùng";

    Alert.alert(
      "Mở chặn người dùng",
      `Bạn có chắc muốn mở chặn ${partnerName}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Mở chặn",
          style: "default",
          onPress: async () => {
            try {
              await friendsService.unblockUser(partnerId);
              setBlockStatus("none");
              GrayToast("Đã mở chặn người dùng");
            } catch {
              GrayToast("Không thể mở chặn người dùng");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleDeleteHistory = useCallback(() => {
    Alert.alert(
      "Xóa lịch sử",
      "Bạn có chắc muốn xóa toàn bộ tin nhắn trong cuộc trò chuyện này? Thao tác này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              setIsSending(true);
              await conversationService.deleteHistory(convId);
              useChatStore.getState().setMessages(convId, []);
              GrayToast("Đã xóa lịch sử trò chuyện");
            } catch (error: any) {
              GrayToast(error?.message || "Không thể xóa lịch sử");
            } finally {
              setIsSending(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [convId]);

  const handleToggleMute = useCallback(async () => {
    if (!convId || !user || !conversation) return;

    const myParticipant = conversation.participants?.find(
      (p) => String(p.userId) === String(user.id)
    ) as any;
    const isCurrentlyMuted = myParticipant?.isMuted || false;

    try {
      setIsSending(true);
      await conversationService.updateParticipantSetting(convId, user.id, {
        isMuted: !isCurrentlyMuted,
      });
      
      const nextParticipants = conversation.participants.map((p) => {
        if (String(p.userId) === String(user.id)) {
          return { ...p, isMuted: !isCurrentlyMuted };
        }
        return p;
      });

      useChatStore.getState().updateConversation(convId, {
        participants: nextParticipants,
      });

      GrayToast(
        !isCurrentlyMuted ? "Đã tắt thông báo" : "Đã bật thông báo"
      );
    } catch (error: any) {
      GrayToast(error?.message || "Không thể thực hiện");
    } finally {
      setIsSending(false);
    }
  }, [convId, conversation, user]);

  const handleHeaderMenuPress = () => {
    const options: Array<{
      text: string;
      style?: "default" | "cancel" | "destructive";
      onPress?: () => void;
    }> = [];

    const myParticipant = conversation?.participants?.find(
        (p) => String(p.userId) === String(user?.id)
    ) as any;
    const isCurrentlyMuted = myParticipant?.isMuted || false;

    if (conversation?.type === "group") {
      options.push({
        text: "Quản trị nhóm",
        onPress: () =>
          router.push({
            pathname: "/(tabs)/chat/group-management",
            params: { conversationId: String(convId) },
          }),
      });
    }

    options.push({
      text: "Tìm tin nhắn",
      onPress: () => setIsSearching(true),
    });

    options.push({
      text: isCurrentlyMuted ? "Bật thông báo" : "Tắt thông báo",
      onPress: handleToggleMute,
    });

    options.push({
      text: "Thông tin hội thoại",
      onPress: () =>
        router.push({
          pathname: "/(tabs)/chat/conversation-info",
          params: { conversationId: String(convId) },
        }),
    });

    options.push({
      text: "Đổi hình nền",
      onPress: () => setShowChatOptions(true),
    });

    options.push({
      text: "Xóa lịch sử trò chuyện",
      style: "destructive",
      onPress: handleDeleteHistory,
    });

    if (conversation?.type === "private") {
      options.push({
        text: isBlockedByMe ? "Mở chặn người dùng" : "Chặn người dùng",
        style: isBlockedByMe ? "default" : "destructive",
        onPress: isBlockedByMe ? handleUnblockUser : handleBlockUser,
      });
    }

    options.push({ text: "Đóng", style: "cancel" });
    Alert.alert("Tùy chọn", undefined, options);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {


    const previousMessage = index > 0 ? displayMessages[index - 1] : null;
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
        onOpenFilePreview={handleOpenFilePreview}
        replyPreview={resolveReplyPreview((item as any).replyTo, convMessages)}
        participants={conversation?.participants || []}
        currentUserId={user?.id}
        onVotePoll={handleVotePoll}
        onAddPollOption={handleAddPollOption}
        onRemovePollOption={handleRemovePollOption}
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
          paddingTop: headerTopPadding,
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
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 4, marginRight: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Avatar name={convName} uri={convAvatar} size={40} />

        <TouchableOpacity 
          style={{ flex: 1, marginLeft: 8 }}
          onPress={() => {
            if (conversation?.type !== 'group') return;
            Alert.prompt(
              "Đổi tên nhóm",
              "Nhập tên mới cho nhóm của bạn",
              [
                { text: "Hủy", style: "cancel" },
                {
                  text: "Đổi tên",
                  onPress: async (newName) => {
                    if (!newName?.trim()) return;
                    try {
                      setIsSending(true);
                      await renameGroup(convId, newName.trim());
                      useChatStore.getState().updateConversation(convId, { name: newName.trim() });
                    } catch (error: any) {
                      Alert.alert("Lỗi", error.message || "Không thể đổi tên nhóm");
                    } finally {
                      setIsSending(false);
                    }
                  }
                }
              ],
              "plain-text",
              convName || ""
            );
          }}
        >
          <Text
            style={{ fontWeight: "700", fontSize: 17, color: "#111827" }}
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
                fontSize: 12,
                color: isPartnerOnline ? "#16A34A" : "#6B7280",
              }}
            >
              {presenceLabel}
            </Text>
          )}
          {conversation?.type === "group" && (
            <Text style={{ fontSize: 12, color: "#6B7280" }}>
              {conversation.participants?.length || 0} thành viên
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ padding: 4 }}
          onPress={() => startCall("audio")}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="call-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ padding: 4 }}
          onPress={() => startCall("video")}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="videocam-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ padding: 4 }}
          onPress={handleHeaderMenuPress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {isSearching && (
        <View style={{ 
          flexDirection: "row", 
          alignItems: "center", 
          paddingHorizontal: 12, 
          paddingVertical: 8, 
          backgroundColor: "#F3F4F6", 
          borderBottomWidth: 1, 
          borderBottomColor: "#E5E7EB" 
        }}>
          <View style={{ 
            flex: 1, 
            flexDirection: "row", 
            alignItems: "center", 
            backgroundColor: "#fff", 
            borderRadius: 8, 
            paddingHorizontal: 10, 
            height: 36 
          }}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              autoFocus
              value={searchMessageQuery}
              onChangeText={setSearchMessageQuery}
              placeholder="Tìm tin nhắn..."
              style={{ flex: 1, height: "100%", marginLeft: 8, fontSize: 14 }}
            />
            {searchMessageQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchMessageQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            onPress={() => {
              setIsSearching(false);
              setSearchMessageQuery("");
            }} 
            style={{ marginLeft: 12 }}
          >
            <Text style={{ color: "#0068FF", fontWeight: "600" }}>Hủy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pinned Message */}
      {pinnedMessage && (
        <View
          style={{
            backgroundColor: "#FFFBEB",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#FDE68A",
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            zIndex: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              flex: 1,
              gap: 10,
            }}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: 2 }}
            >
              <Line x1="12" x2="12" y1="17" y2="22" />
              <Path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
            </Svg>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#D97706",
                  fontSize: 13,
                  fontWeight: "700",
                  marginBottom: 2,
                }}
              >
                Tin nhắn đã ghim
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: "#D97706", fontSize: 13 }}
              >
                {getPinnedMessagePreview(pinnedMessage)}
              </Text>
            </View>
          </View>

          {canPinMessage && (
            <TouchableOpacity
              onPress={handleUnpinMessage}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: "#FEF3C7",
              }}
            >
              <Text
                style={{ color: "#D97706", fontSize: 13, fontWeight: "500" }}
              >
                Bỏ ghim
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Messages */}
      <View
        style={{
          flex: 1,
          position: "relative",
          backgroundColor: chatAreaBackgroundColor,
          overflow: "hidden",
        }}
      >
        {usesImageBackground && (
          <ImageBackground
            source={{ uri: conversationBackground }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
            imageStyle={{ resizeMode: "cover" }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.72)",
              }}
            />
          </ImageBackground>
        )}
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
            data={displayMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingVertical: 4,
              paddingBottom: 2,
              flexGrow: 1,
            }}
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
      </View>

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
      <ForwardMessageModal
        visible={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
      />
      <MessageActionModal
        visible={showMessageActions}
        options={messageActions}
        onClose={() => setShowMessageActions(false)}
      />
      {conversation && (
        <ChatOptionsModal
          visible={showChatOptions}
          onClose={() => setShowChatOptions(false)}
          conversation={conversation}
          onStartSearch={() => setIsSearching(true)}
          onDeleteHistory={handleDeleteHistory}
        />
      )}

      {/* Modals & Input area */}
      {previewTarget && (
        <Modal
          visible={Boolean(previewTarget)}
          animationType="slide"
          onRequestClose={() => setPreviewTarget(null)}
        >
          <View style={{ flex: 1, backgroundColor: "#fff" }}>
            <View
              style={{
                paddingTop: headerTopPadding,
                height: headerTopPadding + 50,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#F3F4F6",
                backgroundColor: "#fff",
              }}
            >
              <TouchableOpacity
                onPress={() => setPreviewTarget(null)}
                style={{ padding: 4, marginRight: 12 }}
              >
                <Ionicons name="close" size={26} color="#111827" />
              </TouchableOpacity>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                {previewTarget.name}
              </Text>
              <TouchableOpacity
                onPress={() => void Linking.openURL(previewTarget.url)}
                style={{ padding: 4 }}
              >
                <Ionicons name="open-outline" size={22} color="#0068FF" />
              </TouchableOpacity>
            </View>

            {previewError ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 40,
                }}
              >
                <Ionicons name="warning-outline" size={64} color="#9CA3AF" />
                <Text
                  style={{
                    marginTop: 16,
                    fontSize: 16,
                    color: "#4B5563",
                    textAlign: "center",
                  }}
                >
                  Không thể mở bản xem trước cho tài liệu này. Hãy thử mở trong
                  trình duyệt.
                </Text>
                <TouchableOpacity
                  onPress={() => void Linking.openURL(previewTarget.url)}
                  style={{
                    marginTop: 20,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: "#0068FF",
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}
                  >
                    Mở ngoài
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <WebView
                source={{ uri: getPreviewWebUri(previewTarget) }}
                style={{ flex: 1 }}
                onLoadStart={() => setPreviewError(false)}
                onError={() => setPreviewError(true)}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
              />
            )}
          </View>
        </Modal>
      )}

      {/* Input area */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
        }}
      >
        {activeReplyPreview && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 14,
              backgroundColor: "#EFF6FF",
              borderWidth: 1,
              borderColor: "#BFDBFE",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              <Ionicons
                name="return-up-back-outline"
                size={18}
                color="#2563EB"
              />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text
                  style={{ color: "#2563EB", fontSize: 12, fontWeight: "700" }}
                >
                  Trả lời {activeReplyPreview.senderName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ marginTop: 2, color: "#475569", fontSize: 13 }}
                >
                  {activeReplyPreview.content}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setReplyToMessageId(null)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#DBEAFE",
              }}
            >
              <Ionicons name="close" size={16} color="#2563EB" />
            </TouchableOpacity>
          </View>
        )}

        {isMessagingBlocked && (
          <View
            style={{
              marginBottom: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#FCD34D",
              backgroundColor: "#FEF3C7",
              paddingHorizontal: 12,
              paddingVertical: 9,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "#92400E", fontSize: 13, fontWeight: "600" }}>
              {isBlockedByMe ? "Bạn đã chặn người dùng này" : "Bạn đã bị chặn"}
            </Text>
            {isBlockedByMe && (
              <TouchableOpacity
                onPress={handleUnblockUser}
                style={{ paddingVertical: 3 }}
              >
                <Text
                  style={{ color: "#92400E", fontSize: 13, fontWeight: "700" }}
                >
                  Mở chặn
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#ECEDEF",
            borderRadius: 28,
            minHeight: 54,
            paddingLeft: 8,
            paddingRight: 10,
            borderWidth: announcementMode ? 1 : 0,
            borderColor: announcementMode ? "#F5C24B" : "transparent",
            opacity: isMessagingBlocked ? 0.6 : 1,
          }}
        >
          <TouchableOpacity
            onPress={handleToggleStickerPicker}
            disabled={Boolean(isMessagingBlocked)}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="happy-outline" size={30} color="#7B8088" />
          </TouchableOpacity>

          {conversation?.type === "group" && (
            <TouchableOpacity
              onPress={() => {
                if (!canSendAnnouncementInGroup) {
                  GrayToast("Bạn không có quyền gửi thông báo trong nhóm này");
                  return;
                }
                setAnnouncementMode((prev) => !prev);
              }}
              disabled={Boolean(isMessagingBlocked)}
              style={{
                width: 38,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 19,
                backgroundColor: announcementMode ? "#FDE9A9" : "transparent",
                marginLeft: 2,
              }}
            >
              <Ionicons
                name="megaphone-outline"
                size={21}
                color={announcementMode ? "#C27A00" : "#7B8088"}
              />
            </TouchableOpacity>
          )}

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Tin nhắn"
            placeholderTextColor="#8A8F98"
            editable={!isMessagingBlocked}
            multiline
            style={{
              flex: 1,
              marginLeft: 4,
              marginRight: 8,
              fontSize: 18,
              color: "#343A40",
              maxHeight: 110,
              paddingVertical: 9,
            }}
          />

          <TouchableOpacity
            onPress={handleOpenMoreActions}
            disabled={Boolean(isMessagingBlocked)}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#7B8088" />
          </TouchableOpacity>

          {!text.trim() ? (
            <TouchableOpacity
              onPress={handleToggleVoiceRecording}
              disabled={Boolean(isMessagingBlocked)}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isRecordingVoice ? "send" : "mic-outline"}
                size={25}
                color={isRecordingVoice ? "#0068FF" : "#7B8088"}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSend}
              disabled={isSending || Boolean(isMessagingBlocked)}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#0068FF" />
              ) : (
                <Ionicons name="send" size={25} color="#0068FF" />
              )}
            </TouchableOpacity>
          )}

          {isRecordingVoice && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "#ECEDEF",
                borderRadius: 26,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                zIndex: 10,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#EF4444",
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: "#EF4444",
                  fontWeight: "600",
                }}
              >
                Đang ghi âm {formatRecordingTime(voiceRecordingSeconds)}
              </Text>

              <TouchableOpacity
                onPress={handleCancelVoiceRecording}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 4,
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleToggleVoiceRecording}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="send" size={24} color="#0068FF" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={handlePickImage}
            disabled={Boolean(isMessagingBlocked)}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="image-outline" size={24} color="#7B8088" />
          </TouchableOpacity>
        </View>

        {showStickerPicker && (
          <View
            style={{
              marginTop: 8,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              backgroundColor: "#F8FAFC",
              paddingVertical: 8,
              paddingHorizontal: 6,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 2 }}
            >
              {STICKER_URLS.map((url, index) => (
                <TouchableOpacity
                  key={`${url}-${index}`}
                  onPress={() => handleSendSticker(url)}
                  disabled={isSending}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    marginRight: index === STICKER_URLS.length - 1 ? 0 : 8,
                    opacity: isSending ? 0.7 : 1,
                  }}
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: 50, height: 50 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
