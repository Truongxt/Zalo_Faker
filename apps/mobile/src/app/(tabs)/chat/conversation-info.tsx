import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
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

type SectionKey = "media" | "files" | "links";

type SectionHeaderProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
};

type MediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
  createdAt: string;
  senderName: string;
};

type FileItem = {
  id: string;
  name: string;
  url: string;
  size?: number;
  createdAt: string;
  extension: string;
  senderName: string;
};

type LinkItem = {
  id: string;
  url: string;
  host: string;
  createdAt: string;
  senderName: string;
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

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const parseFileName = (url: string) => {
  const clean = String(url || "").split("?")[0];
  const last = clean.split("/").pop() || "Tệp tin";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

const parseFileExtension = (name: string) =>
  String(name || "")
    .split(".")
    .pop()
    ?.toLowerCase() || "";

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return "";
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(size / 1024).toFixed(0)} KB`;
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
    return { label: "PDF", iconColor: "#EF4444", boxColor: "#FEE2E2" };
  }
  if (["doc", "docx"].includes(ext)) {
    return { label: "DOC", iconColor: "#2563EB", boxColor: "#DBEAFE" };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return { label: "XLS", iconColor: "#059669", boxColor: "#D1FAE5" };
  }
  if (["mp4", "mov", "mkv", "avi"].includes(ext)) {
    return { label: "VID", iconColor: "#7C3AED", boxColor: "#EDE9FE" };
  }

  return { label: "FILE", iconColor: "#6B7280", boxColor: "#E5E7EB" };
};

function SectionHeader({
  icon,
  title,
  count,
  expanded,
  onToggle,
}: SectionHeaderProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onToggle}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: expanded ? 1 : 0,
        borderBottomColor: "#E2E8F0",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons name={icon} size={18} color="#2563EB" />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 15,
            fontWeight: "700",
            color: "#1E293B",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginLeft: 6,
            fontSize: 12,
            color: "#64748B",
          }}
        >
          ({count})
        </Text>
      </View>
      <Ionicons
        name={expanded ? "chevron-down" : "chevron-forward"}
        size={18}
        color="#64748B"
      />
    </TouchableOpacity>
  );
}

function ActionItem({
  label,
  tone = "default",
  onPress,
  disabled,
}: {
  label: string;
  tone?: "default" | "danger";
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        width: "31.5%",
        minHeight: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tone === "danger" ? "#FECACA" : "#E2E8F0",
        backgroundColor: tone === "danger" ? "#FEF2F2" : "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
        paddingVertical: 10,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: tone === "danger" ? "#DC2626" : "#334155",
          textAlign: "center",
          lineHeight: 17,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function InfoListItem({
  icon,
  iconColor,
  iconBackground,
  title,
  subtitle,
  onPress,
  showBorder = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  showBorder?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        minHeight: 66,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: showBorder ? 1 : 0,
        borderBottomColor: "#E2E8F0",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: iconBackground,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#1E293B" }}>
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ marginTop: 2, fontSize: 12, color: "#64748B" }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

function collectMedia(messages: Message[]): MediaItem[] {
  const output: MediaItem[] = [];
  const seen = new Set<string>();

  messages.forEach((message) => {
    if (message.isDeleted) return;

    (message.attachments || []).forEach((attachment, index) => {
      if (attachment.type !== "image" && attachment.type !== "video") return;
      if (!isHttpUrl(attachment.url)) return;

      const id = `${message.id}-media-${index}`;
      if (seen.has(id)) return;
      seen.add(id);

      output.push({
        id,
        url: attachment.url,
        type: attachment.type,
        createdAt: message.createdAt,
        senderName: message.senderName || "Người dùng",
      });
    });

    if (
      (message.type === "image" || message.type === "video") &&
      isHttpUrl(message.content)
    ) {
      const fallbackId = `${message.id}-media-fallback`;
      if (seen.has(fallbackId)) return;
      seen.add(fallbackId);
      output.push({
        id: fallbackId,
        url: message.content,
        type: message.type,
        createdAt: message.createdAt,
        senderName: message.senderName || "Người dùng",
      });
    }
  });

  return output;
}

function collectFiles(messages: Message[]): FileItem[] {
  const output: FileItem[] = [];
  const seen = new Set<string>();

  messages.forEach((message) => {
    if (message.isDeleted) return;

    (message.attachments || []).forEach((attachment, index) => {
      if (attachment.type !== "file") return;
      if (!isHttpUrl(attachment.url)) return;

      const id = `${message.id}-file-${index}`;
      if (seen.has(id)) return;
      seen.add(id);

      const name = attachment.name || parseFileName(attachment.url);
      output.push({
        id,
        name,
        url: attachment.url,
        size: attachment.size,
        createdAt: message.createdAt,
        extension: parseFileExtension(name),
        senderName: message.senderName || "Người dùng",
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
        senderName: message.senderName || "Người dùng",
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
        senderName: message.senderName || "Người dùng",
      });
    });
  });

  return output;
}

export default function ConversationInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerTopPadding = insets.top + 8;
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { user } = useAuthStore();
  const { conversations, messages, updateConversation } = useChatStore();

  const id = String(conversationId || "");

  const conversation = useMemo<Conversation | undefined>(
    () => conversations.find((item) => String(item.id) === id),
    [conversations, id],
  );

  const convMessages = useMemo<Message[]>(
    () => (messages as Record<string, Message[]>)[id] || [],
    [messages, id],
  );

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

  const subtitle =
    conversation?.type === "group"
      ? `${conversation.participants.length} thành viên`
      : "Trò chuyện riêng tư";

  const isMuted = currentParticipant?.isMuted ?? false;
  const isPinned =
    currentParticipant?.isPinned ?? conversation?.isPinned ?? false;

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
  const [showAllInfoItems, setShowAllInfoItems] = useState<
    Record<SectionKey, boolean>
  >({
    media: false,
    files: false,
    links: false,
  });

  useEffect(() => {
    setShowMedia(true);
    setShowFiles(true);
    setShowLinks(true);
    setShowAllInfoItems({
      media: false,
      files: false,
      links: false,
    });
  }, [id]);

  const mediaItems = useMemo(() => collectMedia(convMessages), [convMessages]);
  const fileItems = useMemo(() => collectFiles(convMessages), [convMessages]);
  const linkItems = useMemo(() => collectLinks(convMessages), [convMessages]);

  const visibleMedia = showAllInfoItems.media ? mediaItems : mediaItems.slice(0, 6);
  const visibleFiles = showAllInfoItems.files ? fileItems : fileItems.slice(0, 4);
  const visibleLinks = showAllInfoItems.links ? linkItems : linkItems.slice(0, 4);

  const toggleShowAllInfoItems = (key: SectionKey) => {
    setShowAllInfoItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
        .conversations.find((item) => String(item.id) === String(conversation.id)) ||
      conversation;

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
    muteUntil,
    successMessage,
  }: {
    isMuted: boolean;
    muteUntil: string | null;
    successMessage: string;
  }) => {
    if (!conversation || !user?.id || isUpdatingMute) return;

    try {
      setIsUpdatingMute(true);
      await conversationService.updateParticipantSetting(conversation.id, user.id, {
        isMuted: nextMuted,
        muteUntil,
      });
      patchCurrentParticipant({ isMuted: nextMuted, muteUntil });
      GrayToast(successMessage);
    } catch {
      GrayToast(nextMuted ? "Không thể tắt thông báo" : "Không thể bật thông báo");
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
        successMessage: "Đã tắt thông báo",
      });
      return;
    }

    Alert.alert(
      "Tắt thông báo",
      "Chọn thời gian tắt thông báo cho hội thoại này",
      [
        ...MUTE_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => {
            const nextMuteUntil = option.getUntil();
            void updateMuteSetting({
              isMuted: true,
              muteUntil: nextMuteUntil,
              successMessage:
                option.id === "forever"
                  ? "Đã tắt thông báo cho đến khi được mở lại."
                  : `Đã tắt thông báo ${option.label.toLowerCase()}`,
            });
          },
        })),
        { text: "Hủy", style: "cancel" as const },
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ECEEF3" }} edges={["bottom"]}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: headerTopPadding,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ECEEF3" }} edges={["bottom"]}>
      <View
        style={{
          minHeight: 56 + headerTopPadding,
          paddingTop: headerTopPadding,
          paddingBottom: 10,
          paddingHorizontal: 12,
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
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            position: "absolute",
            left: 12,
            bottom: 10,
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#1E293B" }}>
          Thông tin hội thoại
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 18,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Avatar name={displayName} uri={displayAvatar} size={80} />
            <Text
              style={{
                marginTop: 12,
                fontSize: 22,
                fontWeight: "700",
                color: "#0F172A",
              }}
            >
              {displayName}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#64748B",
              }}
            >
              {subtitle}
            </Text>
          </View>

          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <ActionItem
              label={isMuted ? "Bật thông báo" : "Tắt thông báo"}
              onPress={handleMutePress}
            />
            <ActionItem
              label={isPinned ? "Bỏ ghim" : "Ghim hội thoại"}
              onPress={() => {
                void handlePinPress();
              }}
            />
            <ActionItem
              label={conversation.type === "group" ? "Quản lý nhóm" : "Tạo nhóm chat"}
              onPress={() => GrayToast("Tính năng đang phát triển")}
            />
          </View>
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <InfoListItem
            icon="time-outline"
            iconColor="#2563EB"
            iconBackground="#DBEAFE"
            title="Nhắc hẹn"
            subtitle="Tạo lời nhắc trong đoạn chat"
            onPress={() => GrayToast("Tính năng đang phát triển")}
            showBorder
          />
          <InfoListItem
            icon="people-outline"
            iconColor="#2563EB"
            iconBackground="#DBEAFE"
            title="Nhóm chat chung"
            subtitle={
              conversation.type === "group"
                ? "Cuộc trò chuyện nhóm hiện tại"
                : `${commonGroupCount} nhóm chung`
            }
            onPress={() => GrayToast("Tính năng đang phát triển")}
          />
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <SectionHeader
            icon="images-outline"
            title="Ảnh/Video"
            count={mediaItems.length}
            expanded={showMedia}
            onToggle={() => setShowMedia((prev) => !prev)}
          />

          {showMedia ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 }}>
              {visibleMedia.length === 0 ? (
                <Text style={{ color: "#64748B", fontSize: 12 }}>
                  Chưa có ảnh hoặc video được chia sẻ.
                </Text>
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                  }}
                >
                  {visibleMedia.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => openLink(item.url)}
                      style={{
                        width: "31.8%",
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          borderRadius: 14,
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
                              right: 8,
                              bottom: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 999,
                              backgroundColor: "rgba(15,23,42,0.72)",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                              Video
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {mediaItems.length > 6 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggleShowAllInfoItems("media")}
                  style={{ marginTop: 4, alignSelf: "flex-start" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563EB" }}>
                    {showAllInfoItems.media ? "Thu gọn" : "Xem tất cả"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <SectionHeader
            icon="document-text-outline"
            title="File"
            count={fileItems.length}
            expanded={showFiles}
            onToggle={() => setShowFiles((prev) => !prev)}
          />

          {showFiles ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 }}>
              {visibleFiles.length === 0 ? (
                <Text style={{ color: "#64748B", fontSize: 12 }}>
                  Chưa có tệp được chia sẻ.
                </Text>
              ) : (
                visibleFiles.map((item) => {
                  const badge = getFileBadge(item.extension);
                  const fileMeta = [formatDate(item.createdAt), formatFileSize(item.size), item.senderName]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => openLink(item.url)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 16,
                        backgroundColor: "#F8FAFC",
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
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

                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{ color: "#1E293B", fontWeight: "600", fontSize: 14 }}
                        >
                          {item.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ marginTop: 3, color: "#64748B", fontSize: 12 }}
                        >
                          {fileMeta}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {fileItems.length > 4 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggleShowAllInfoItems("files")}
                  style={{ marginTop: 4, alignSelf: "flex-start" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563EB" }}>
                    {showAllInfoItems.files ? "Thu gọn" : "Xem tất cả"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 12,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E2E8F0",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <SectionHeader
            icon="link-outline"
            title="Link"
            count={linkItems.length}
            expanded={showLinks}
            onToggle={() => setShowLinks((prev) => !prev)}
          />

          {showLinks ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 }}>
              {visibleLinks.length === 0 ? (
                <Text style={{ color: "#64748B", fontSize: 12 }}>
                  Chưa có liên kết được chia sẻ.
                </Text>
              ) : (
                visibleLinks.map((item) => {
                  const linkMeta = [item.host, formatDate(item.createdAt), item.senderName]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => openLink(item.url)}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        borderRadius: 16,
                        backgroundColor: "#F8FAFC",
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: "#DBEAFE",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 10,
                        }}
                      >
                        <Ionicons name="link-outline" size={18} color="#2563EB" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{ color: "#1E293B", fontWeight: "600", fontSize: 14 }}
                        >
                          {item.url}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ marginTop: 3, color: "#64748B", fontSize: 12 }}
                        >
                          {linkMeta}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {linkItems.length > 4 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggleShowAllInfoItems("links")}
                  style={{ marginTop: 4, alignSelf: "flex-start" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#2563EB" }}>
                    {showAllInfoItems.links ? "Thu gọn" : "Xem tất cả"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={{ height: 4 }} />
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
