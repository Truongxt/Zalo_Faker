import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Avatar } from "@/components/ui/Avatar";
import { GrayToast } from "@/components/ui";
import { chatService } from "@/services/chat";
import { conversationService } from "@/services/conversationService";
import { aiService, type AISummaryResponse } from "@/services/aiService";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import type { Conversation, Message } from "@/types";

type SectionProps = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
};

type MediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
};

type FileItem = {
  id: string;
  name: string;
  url: string;
  size?: number;
  createdAt: string;
  extension: string;
};

type LinkItem = {
  id: string;
  url: string;
  host: string;
  createdAt: string;
};

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

const MUTE_OPTIONS = [
  {
    id: "1h",
    label: "Trong 1 giờ",
    getUntil: () => new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
  {
    id: "4h",
    label: "Trong 4 giờ",
    getUntil: () => new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "8am",
    label: "Đến 8 giờ sáng",
    getUntil: () => {
      const now = new Date();
      const next8am = new Date(now);
      next8am.setHours(8, 0, 0, 0);
      if (next8am <= now) next8am.setDate(next8am.getDate() + 1);
      return next8am.toISOString();
    },
  },
  {
    id: "forever",
    label: "Cho đến khi được mở lại",
    getUntil: () => null,
  },
] as const;

const formatMuteUntilLabel = (muteUntil?: string | null) => {
  if (!muteUntil) return "Đã tắt cho đến khi bạn bật lại";

  const time = new Date(muteUntil);
  if (Number.isNaN(time.getTime())) return "Đã tắt thông báo";

  return `Đang tắt đến ${time.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  })}`;
};

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const parseFileName = (url: string) => {
  const clean = String(url || "").split("?")[0];
  const last = clean.split("/").pop() || "Tệp tin";
  return decodeURIComponent(last);
};

const parseFileExtension = (name: string) => {
  const ext =
    String(name || "")
      .split(".")
      .pop()
      ?.toLowerCase() || "";
  return ext;
};

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return "-";
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(size / 1024).toFixed(2)} KB`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--/--/----";

  return d.toLocaleDateString("vi-VN");
};

const getHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const getFileBadge = (extension: string) => {
  const ext = extension.toLowerCase();

  if (ext === "pdf") {
    return {
      label: "PDF",
      iconColor: "#EF4444",
      boxColor: "#FEE2E2",
    };
  }

  if (["doc", "docx"].includes(ext)) {
    return {
      label: "DOC",
      iconColor: "#2563EB",
      boxColor: "#DBEAFE",
    };
  }

  if (["xls", "xlsx", "csv"].includes(ext)) {
    return {
      label: "XLS",
      iconColor: "#059669",
      boxColor: "#D1FAE5",
    };
  }

  if (["mp4", "mov", "mkv", "avi"].includes(ext)) {
    return {
      label: "VID",
      iconColor: "#7C3AED",
      boxColor: "#EDE9FE",
    };
  }

  return {
    label: "FILE",
    iconColor: "#6B7280",
    boxColor: "#E5E7EB",
  };
};

function SectionHeader({ title, expanded, onToggle }: SectionProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 10,
      }}
    >
      <Text style={{ fontSize: 30 / 2, fontWeight: "700", color: "#1E293B" }}>
        {title}
      </Text>
      <Ionicons
        name={expanded ? "chevron-up" : "chevron-down"}
        size={18}
        color="#64748B"
      />
    </TouchableOpacity>
  );
}

function ActionItem({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={{
        alignItems: "center",
        width: "23%",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#E2E8F0",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon} size={20} color="#475569" />
      </View>
      <Text
        style={{
          fontSize: 13,
          color: "#334155",
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function collectMedia(messages: Message[]): MediaItem[] {
  const output: MediaItem[] = [];
  const seen = new Set<string>();

  messages.forEach((message) => {
    if (message.isDeleted) return;

    const list = message.attachments || [];
    list.forEach((attachment, index) => {
      if (attachment.type !== "image" && attachment.type !== "video") return;
      if (!isHttpUrl(attachment.url)) return;

      const id = `${message.id}-media-${index}`;
      if (seen.has(id)) return;
      seen.add(id);

      output.push({
        id,
        url: attachment.url,
        type: attachment.type,
      });
    });

    if (
      (message.type === "image" || message.type === "video") &&
      isHttpUrl(message.content)
    ) {
      const fallbackId = `${message.id}-media-fallback`;
      if (!seen.has(fallbackId)) {
        seen.add(fallbackId);
        output.push({
          id: fallbackId,
          url: message.content,
          type: message.type,
        });
      }
    }
  });

  return output;
}

function collectFiles(messages: Message[]): FileItem[] {
  const output: FileItem[] = [];
  const seen = new Set<string>();

  messages.forEach((message) => {
    if (message.isDeleted) return;

    const list = message.attachments || [];
    list.forEach((attachment, index) => {
      if (attachment.type !== "file") return;
      if (!isHttpUrl(attachment.url)) return;

      const name = attachment.name || parseFileName(attachment.url);
      const extension = parseFileExtension(name);
      const id = `${message.id}-file-${index}`;
      if (seen.has(id)) return;
      seen.add(id);

      output.push({
        id,
        name,
        url: attachment.url,
        size: attachment.size,
        createdAt: message.createdAt,
        extension,
      });
    });

    if (message.type === "file" && isHttpUrl(message.content)) {
      const fallbackId = `${message.id}-file-fallback`;
      if (seen.has(fallbackId)) return;
      seen.add(fallbackId);

      const fileName = parseFileName(message.content);
      output.push({
        id: fallbackId,
        name: fileName,
        url: message.content,
        createdAt: message.createdAt,
        extension: parseFileExtension(fileName),
      });
    }
  });

  return output;
}

function collectLinks(messages: Message[]): LinkItem[] {
  const output: LinkItem[] = [];
  const seen = new Set<string>();

  messages.forEach((message) => {
    if (message.isDeleted) return;
    if (!message.content) return;

    const content = String(message.content);
    const matches: string[] = content.match(URL_REGEX) ?? [];

    matches.forEach((url, index) => {
      const normalized = url.trim();
      if (!isHttpUrl(normalized)) return;

      const id = `${message.id}-link-${index}-${normalized}`;
      if (seen.has(id)) return;
      seen.add(id);

      output.push({
        id,
        url: normalized,
        host: getHost(normalized),
        createdAt: message.createdAt,
      });
    });
  });

  return output;
}

export default function ConversationInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();

  const { user } = useAuthStore();
  const { conversations, messages, updateConversation } = useChatStore();

  const id = String(conversationId || "");

  const conversation = useMemo<Conversation | undefined>(
    () => conversations.find((item) => String(item.id) === id),
    [conversations, id],
  );

  const convMessages = useMemo<Message[]>(() => {
    return (messages as Record<string, Message[]>)[id] || [];
  }, [messages, id]);

  useEffect(() => {
    if (!id || convMessages.length > 0) return;

    chatService.loadMessages(id).catch(() => null);
  }, [convMessages.length, id]);

  const otherParticipant = useMemo(() => {
    if (!conversation || !user?.id) return undefined;

    return conversation.participants.find(
      (participant) => String(participant.userId) !== String(user.id),
    );
  }, [conversation, user?.id]);

  const currentParticipant = useMemo(() => {
    if (!conversation || !user?.id) return undefined;

    return conversation.participants.find(
      (participant) => String(participant.userId) === String(user.id),
    );
  }, [conversation, user?.id]);

  const commonGroupCount = useMemo(() => {
    if (
      !conversation ||
      conversation.type !== "private" ||
      !user?.id ||
      !otherParticipant?.userId
    ) {
      return 0;
    }

    return conversations.filter((item) => {
      if (item.type !== "group") return false;

      const participantIds = item.participants.map((participant) =>
        String(participant.userId),
      );
      return (
        participantIds.includes(String(user.id)) &&
        participantIds.includes(String(otherParticipant.userId))
      );
    }).length;
  }, [conversation, conversations, otherParticipant?.userId, user?.id]);

  const displayName =
    conversation?.type === "group"
      ? conversation.name || "Nhóm"
      : otherParticipant?.fullName || "Người dùng";

  const displayAvatar =
    conversation?.type === "group"
      ? conversation.avatarUrl
      : otherParticipant?.avatarUrl;

  const isMuted = currentParticipant?.isMuted ?? false;
  const isPinned =
    currentParticipant?.isPinned ?? conversation?.isPinned ?? false;
  const muteUntil = currentParticipant?.muteUntil ?? null;
  const [isUpdatingMute, setIsUpdatingMute] = useState(false);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryResult, setSummaryResult] = useState<AISummaryResponse | null>(
    null,
  );
  const [showMedia, setShowMedia] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const [showLinks, setShowLinks] = useState(true);

  const mediaItems = useMemo(() => collectMedia(convMessages), [convMessages]);
  const fileItems = useMemo(() => collectFiles(convMessages), [convMessages]);
  const linkItems = useMemo(() => collectLinks(convMessages), [convMessages]);

  const mediaPreview = mediaItems.slice(0, 9);
  const filePreview = fileItems.slice(0, 3);
  const linkPreview = linkItems.slice(0, 3);

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      GrayToast("Không thể mở liên kết");
    }
  };

  const patchCurrentParticipant = (updates: Record<string, unknown>) => {
    if (!conversation || !user?.id) return;

    const liveConversation =
      useChatStore
        .getState()
        .conversations.find(
          (item) => String(item.id) === String(conversation.id),
        ) || conversation;

    updateConversation(conversation.id, {
      ...(Object.prototype.hasOwnProperty.call(updates, "isPinned")
        ? { isPinned: Boolean(updates.isPinned) }
        : {}),
      participants: liveConversation.participants.map((participant) =>
        String(participant.userId) === String(user.id)
          ? ({ ...participant, ...updates } as any)
          : participant,
      ),
    });
  };

  const updateMuteSetting = async ({
    isMuted: nextMuted,
    muteUntil: nextMuteUntil,
    successMessage,
  }: {
    isMuted: boolean;
    muteUntil: string | null;
    successMessage: string;
  }) => {
    if (!conversation || !user?.id || isUpdatingMute) return;

    try {
      setIsUpdatingMute(true);
      await conversationService.updateParticipantSetting(
        conversation.id,
        user.id,
        {
          isMuted: nextMuted,
          muteUntil: nextMuteUntil,
        },
      );
      patchCurrentParticipant({ isMuted: nextMuted, muteUntil: nextMuteUntil });
      GrayToast(successMessage);
    } catch {
      GrayToast(
        nextMuted ? "Không thể tắt thông báo" : "Không thể bật thông báo",
      );
    } finally {
      setIsUpdatingMute(false);
    }
  };

  const handleMutePress = () => {
    if (!conversation || !user?.id || isUpdatingMute) return;

    if (isMuted) {
      void updateMuteSetting({
        isMuted: false,
        muteUntil: null,
        successMessage: "Đã bật thông báo",
      });
      return;
    }

    Alert.alert(
      "Tắt thông báo",
      "Chọn thời gian tắt thông báo cho cuộc trò chuyện này",
      [
        ...MUTE_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => {
            const nextMuteUntil = option.getUntil();
            const successMessage =
              option.id === "forever"
                ? "Đã tắt thông báo cho đến khi bật lại"
                : `Đã tắt thông báo ${option.label.toLowerCase()}`;

            void updateMuteSetting({
              isMuted: true,
              muteUntil: nextMuteUntil,
              successMessage,
            });
          },
        })),
        {
          text: "Hủy",
          style: "cancel",
        },
      ],
      { cancelable: true },
    );
  };

  const handlePinPress = async () => {
    if (!conversation || !user?.id || isUpdatingPin) return;

    try {
      setIsUpdatingPin(true);
      await conversationService.togglePin(conversation.id, user.id, !isPinned);
      patchCurrentParticipant({ isPinned: !isPinned });
      GrayToast(isPinned ? "Đã bỏ ghim hội thoại" : "Đã ghim hội thoại");
    } catch {
      GrayToast("Không thể cập nhật trạng thái ghim");
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleSummarizeToday = async () => {
    if (!conversation || isSummarizing) return;

    setShowSummaryModal(true);
    setSummaryResult(null);
    setIsSummarizing(true);

    try {
      const result = await aiService.summarizeConversation(conversation.id);
      setSummaryResult(result);
    } catch (error) {
      console.error("Khong the tom tat hoi thoai:", error);
      setSummaryResult({
        conversationId: conversation.id,
        date: new Date().toISOString().slice(0, 10),
        messageCount: 0,
        summary: "Không thể tóm tắt lúc này. Vui lòng thử lại sau.",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  if (!id || !conversation) {
    return (
      <SafeAreaView className="flex-1 bg-[#ECEEF3]" edges={["top", "bottom"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text style={{ fontSize: 16, color: "#64748B", textAlign: "center" }}>
            Không tìm thấy thông tin hội thoại
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 14,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: "#2563EB",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#ECEEF3]" edges={["top", "bottom"]}>
      <View
        style={{
          height: 56 + Math.max(insets.top, 0),
          paddingTop: Math.max(insets.top, 0),
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E2E8F0",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            position: "absolute",
            left: 8,
            bottom: 10,
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={{ fontSize: 25 / 2, fontWeight: "700", color: "#1E293B" }}>
          Thông tin hội thoại
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <View
          style={{
            marginTop: 8,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#E2E8F0",
            paddingVertical: 14,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Avatar name={displayName} uri={displayAvatar} size={70} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 10,
                gap: 6,
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "700", color: "#0F172A" }}
              >
                {displayName}
              </Text>
              <TouchableOpacity
                onPress={() => GrayToast("Tính năng đổi tên đang phát triển")}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#E2E8F0",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="create-outline" size={14} color="#334155" />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 12,
            }}
          >
            <ActionItem
              icon="notifications-off-outline"
              label="Tắt thông báo"
              onPress={handleMutePress}
            />
            <ActionItem
              icon="pin-outline"
              label="Ghim hội thoại"
              onPress={() => {
                void handlePinPress();
              }}
            />
            <ActionItem
              icon="sparkles-outline"
              label={isSummarizing ? "Đang tóm tắt" : "Tóm tắt hôm nay"}
              onPress={() => {
                void handleSummarizeToday();
              }}
              disabled={isSummarizing}
            />
            <ActionItem
              icon="people-outline"
              label="Tạo nhóm trò chuyện"
              onPress={() => {
                if (conversation.type === "group") {
                  GrayToast("Đây đã là nhóm trò chuyện");
                  return;
                }
                GrayToast("Tính năng đang phát triển");
              }}
            />
          </View>
        </View>

        <View
          style={{
            marginTop: 8,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#E2E8F0",
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => GrayToast("Tính năng đang phát triển")}
            style={{
              minHeight: 50,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: "#E2E8F0",
              gap: 10,
            }}
          >
            <Ionicons name="time-outline" size={19} color="#334155" />
            <Text style={{ color: "#1E293B", fontSize: 16 }}>
              Danh sách nhắc hẹn
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => GrayToast("Tính năng đang phát triển")}
            style={{
              minHeight: 50,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Ionicons name="people-outline" size={19} color="#334155" />
            <Text style={{ color: "#1E293B", fontSize: 16 }}>
              {commonGroupCount} nhóm chung
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 8,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#E2E8F0",
          }}
        >
          <SectionHeader
            title="Ảnh/Video"
            expanded={showMedia}
            onToggle={() => setShowMedia((prev) => !prev)}
          />

          {showMedia ? (
            <>
              <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                {mediaPreview.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {mediaPreview.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        onPress={() =>
                          GrayToast("Tính năng xem media đang phát triển")
                        }
                        style={{
                          width: "33.33%",
                          padding: 3,
                        }}
                      >
                        <View
                          style={{
                            borderRadius: 8,
                            overflow: "hidden",
                            backgroundColor: "#CBD5E1",
                            aspectRatio: 1,
                          }}
                        >
                          <Image
                            source={{ uri: item.url }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                          {item.type === "video" ? (
                            <View
                              style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <View
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 15,
                                  backgroundColor: "rgba(15,23,42,0.55)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons name="play" size={16} color="#fff" />
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: "#64748B", paddingVertical: 6 }}>
                    Chưa có ảnh/video
                  </Text>
                )}
              </View>

              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    GrayToast("Tính năng xem toàn bộ media đang phát triển")
                  }
                  style={{
                    height: 42,
                    borderRadius: 7,
                    backgroundColor: "#E5E7EB",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24 / 2,
                      fontWeight: "700",
                      color: "#1E293B",
                    }}
                  >
                    Xem tất cả
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 8,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#E2E8F0",
          }}
        >
          <SectionHeader
            title="File"
            expanded={showFiles}
            onToggle={() => setShowFiles((prev) => !prev)}
          />

          {showFiles ? (
            <>
              <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                {filePreview.length ? (
                  filePreview.map((item) => {
                    const badge = getFileBadge(item.extension);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.8}
                        onPress={() => openLink(item.url)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 8,
                            backgroundColor: badge.boxColor,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 10,
                          }}
                        >
                          <Text
                            style={{
                              color: badge.iconColor,
                              fontWeight: "800",
                              fontSize: 12,
                            }}
                          >
                            {badge.label}
                          </Text>
                        </View>

                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text
                            numberOfLines={1}
                            style={{ color: "#1E293B", fontWeight: "600" }}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={{
                              marginTop: 3,
                              color: "#64748B",
                              fontSize: 13,
                            }}
                          >
                            {formatFileSize(item.size)}
                          </Text>
                        </View>

                        <Text style={{ color: "#64748B", fontSize: 13 }}>
                          {formatDate(item.createdAt)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={{ color: "#64748B", paddingVertical: 6 }}>
                    Chưa có file
                  </Text>
                )}
              </View>

              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    GrayToast("Tính năng xem toàn bộ file đang phát triển")
                  }
                  style={{
                    height: 42,
                    borderRadius: 7,
                    backgroundColor: "#E5E7EB",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24 / 2,
                      fontWeight: "700",
                      color: "#1E293B",
                    }}
                  >
                    Xem tất cả
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 8,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#E2E8F0",
          }}
        >
          <SectionHeader
            title="Link"
            expanded={showLinks}
            onToggle={() => setShowLinks((prev) => !prev)}
          />

          {showLinks ? (
            <>
              <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                {linkPreview.length ? (
                  linkPreview.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => openLink(item.url)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: "#E2E8F0",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 10,
                        }}
                      >
                        <Ionicons
                          name="link-outline"
                          size={18}
                          color="#475569"
                        />
                      </View>

                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text
                          numberOfLines={1}
                          style={{ color: "#1E293B", fontWeight: "600" }}
                        >
                          {item.host}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 3,
                            color: "#2563EB",
                            fontSize: 13,
                          }}
                        >
                          {item.url}
                        </Text>
                      </View>

                      <Text style={{ color: "#64748B", fontSize: 13 }}>
                        {formatDate(item.createdAt)}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={{ color: "#64748B", paddingVertical: 6 }}>
                    Chưa có liên kết
                  </Text>
                )}
              </View>

              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    GrayToast("Tính năng xem toàn bộ liên kết đang phát triển")
                  }
                  style={{
                    height: 42,
                    borderRadius: 7,
                    backgroundColor: "#E5E7EB",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 24 / 2,
                      fontWeight: "700",
                      color: "#1E293B",
                    }}
                  >
                    Xem tất cả
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 8,
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#E2E8F0",
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                style={{ color: "#1E293B", fontSize: 15, fontWeight: "600" }}
              >
                Tắt thông báo
              </Text>
              <Text style={{ marginTop: 2, color: "#64748B", fontSize: 12 }}>
                {isMuted
                  ? formatMuteUntilLabel(muteUntil)
                  : "Đang bật thông báo"}
              </Text>
            </View>
            <Switch
              value={isMuted}
              onValueChange={handleMutePress}
              disabled={isUpdatingMute}
              trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
              thumbColor="#fff"
            />
          </View>

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                style={{ color: "#1E293B", fontSize: 15, fontWeight: "600" }}
              >
                Ghim hội thoại
              </Text>
              <Text style={{ marginTop: 2, color: "#64748B", fontSize: 12 }}>
                {isPinned ? "Đang ghim" : "Chưa ghim"}
              </Text>
            </View>
            <Switch
              value={isPinned}
              onValueChange={() => {
                void handlePinPress();
              }}
              disabled={isUpdatingPin}
              trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <Modal
        visible={showSummaryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 18,
          }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
            activeOpacity={1}
            onPress={() => {
              if (!isSummarizing) setShowSummaryModal(false);
            }}
          />

          <View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 16,
              backgroundColor: "#FFFFFF",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#E2E8F0",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: "#DBEAFE",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="sparkles-outline" size={16} color="#1D4ED8" />
                </View>
                <View>
                  <Text
                    style={{
                      color: "#0F172A",
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Tóm tắt hôm nay
                  </Text>
                  {summaryResult ? (
                    <Text
                      style={{ color: "#64748B", fontSize: 12, marginTop: 1 }}
                    >
                      {summaryResult.date} • {summaryResult.messageCount} tin
                      nhắn
                    </Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowSummaryModal(false)}
                disabled={isSummarizing}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#F1F5F9",
                }}
              >
                <Ionicons name="close" size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              {isSummarizing ? (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text
                    style={{ marginTop: 12, color: "#475569", fontSize: 14 }}
                  >
                    AI đang tóm tắt hội thoại...
                  </Text>
                </View>
              ) : summaryResult ? (
                <ScrollView
                  style={{ maxHeight: 260 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text
                    style={{
                      color: "#1E293B",
                      fontSize: 15,
                      lineHeight: 22,
                    }}
                  >
                    {summaryResult.summary}
                  </Text>
                </ScrollView>
              ) : null}
            </View>

            {!isSummarizing ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#E2E8F0",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    void handleSummarizeToday();
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: "#DBEAFE",
                  }}
                >
                  <Text style={{ color: "#1D4ED8", fontWeight: "600" }}>
                    Tóm tắt lại
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowSummaryModal(false)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: "#2563EB",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Đóng</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
