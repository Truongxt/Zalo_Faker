import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Conversation, Label } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  allLabels?: Label[];
  isOnline?: boolean;
  onPress: () => void;
  onLongPress?: (conversation: Conversation) => void;
}

type ParsedCallPayload = {
  callType: "audio" | "video";
  status: string;
};

const getConversationName = (conversation: Conversation, currentUserId: string) => {
  if (conversation.type === "group") return conversation.name || "Nhom chat";
  const partner = conversation.participants?.find(
    (p) => String(p.userId) !== String(currentUserId),
  );
  return partner?.fullName || "Nguoi dung";
};

const getConversationAvatar = (conversation: Conversation, currentUserId: string) => {
  if (conversation.type === "group") return conversation.avatarUrl;
  const partner = conversation.participants?.find(
    (p) => String(p.userId) !== String(currentUserId),
  );
  return partner?.avatarUrl || null;
};

const normalizeCallType = (value: unknown): ParsedCallPayload["callType"] | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "audio" || normalized === "voice") return "audio";
  return null;
};

const normalizeCallStatus = (value: unknown): string | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return normalized === "ended" ? "finished" : normalized;
};

const parseCallPayloadFromObject = (
  value: Record<string, unknown>,
): ParsedCallPayload | null => {
  const callType = normalizeCallType(value.callType);
  const status = normalizeCallStatus(value.status || value.callStatus);
  if (!callType || !status) return null;
  return { callType, status };
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

const getCallPreviewText = (payload: ParsedCallPayload) => {
  const suffix = payload.callType === "video" ? " video" : "";
  if (payload.status === "finished") return `Cuộc gọi${suffix}`;
  if (payload.status === "missed") return `Cuộc gọi nhỡ${suffix}`;
  if (payload.status === "rejected") return "Cuộc gọi bị từ chối";
  if (payload.status === "cancelled") return "Cuộc gọi đã hủy";
  return payload.callType === "video" ? "Cuộc gọi video" : "Cuộc gọi";
};

const extractTextContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object" || Array.isArray(content)) return "";

  const objectValue = content as Record<string, unknown>;
  return typeof objectValue.text === "string"
    ? objectValue.text
    : typeof objectValue.message === "string"
      ? objectValue.message
      : typeof objectValue.content === "string"
        ? objectValue.content
        : "";
};

const getLastMessageText = (conversation: Conversation) => {
  const lastMessage = conversation.lastMessage;
  if (!lastMessage) return "Chua co tin nhan";

  const callPayload = parseCallPayload(lastMessage.content);
  let baseText = "";

  if (lastMessage.type === "call" || callPayload) {
    baseText = getCallPreviewText(callPayload || { callType: "audio", status: "finished" });
  } else {
    const text = extractTextContent(lastMessage.content).trim();
    if (text) {
      baseText = text;
    } else if (lastMessage.type === "image") {
      baseText = "[Hinh anh]";
    } else if (lastMessage.type === "video") {
      baseText = "[Video]";
    } else if (lastMessage.type === "voice") {
      baseText = "[Tin nhan thoai]";
    } else if (lastMessage.type === "sticker") {
      baseText = "[Sticker]";
    } else if (lastMessage.type === "file") {
      const content =
        lastMessage.content && typeof lastMessage.content === "object"
          ? (lastMessage.content as Record<string, unknown>)
          : null;
      const fileName = content && typeof content.fileName === "string" ? content.fileName : "";
      baseText = fileName ? `[File] ${fileName}` : "[Tap tin]";
    } else {
      baseText = "[Tin nhan]";
    }
  }

  const isForwarded = Boolean((lastMessage as any)?.metadata?.isForwarded);
  return isForwarded ? `Chuyen tiep: ${baseText}` : baseText;
};

const getLastMessageTime = (conversation: Conversation) => {
  const rawTime =
    (conversation.lastMessage as any)?.createdAt ||
    (conversation.lastMessage as any)?.timestamp;
  if (!rawTime) return "";
  try {
    return formatDistanceToNow(new Date(rawTime), { addSuffix: true, locale: vi });
  } catch {
    return "";
  }
};

export function ConversationItem({
  conversation,
  currentUserId,
  allLabels = [],
  isOnline = false,
  onPress,
  onLongPress,
}: ConversationItemProps) {
  const name = getConversationName(conversation, currentUserId);
  const avatar = getConversationAvatar(conversation, currentUserId);
  const lastMessage = getLastMessageText(conversation);
  const lastMessageTime = getLastMessageTime(conversation);
  const unreadCount = Number(conversation.unreadCount || 0);

  const participant = conversation.participants?.find((p) => String(p.userId) === String(currentUserId));
  const isMuted = participant?.isMuted;
  const labelIds = participant?.labelIds || [];
  const activeLabels = allLabels.filter((l) => labelIds.includes(l._id));

  const bgColor = conversation.isPinned ? "#EFF6FF" : "#fff";

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={() => onLongPress?.(conversation)}
      delayLongPress={400}
      activeOpacity={0.75}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
        backgroundColor: bgColor,
      }}
    >
      <View style={{ position: "relative" }}>
        <Avatar name={name} uri={avatar} size={54} isGroup={conversation.type === "group"} />
        {conversation.type !== "group" && isOnline && (
          <View
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#22C55E",
              borderWidth: 2,
              borderColor: bgColor,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: conversation.isPinned || unreadCount > 0 ? "700" : "600",
              color: "#111827",
              marginRight: 6,
            }}
            numberOfLines={1}
          >
            {name}
          </Text>
          <View style={{ flexDirection: "row", gap: 3 }}>
            {activeLabels.map((l) => (
              <Ionicons
                key={l._id}
                name="pricetag"
                size={14}
                color={l.color}
              />
            ))}
          </View>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: unreadCount > 0 ? "#1F2937" : "#6B7280",
            fontWeight: unreadCount > 0 ? "500" : "400",
          }}
          numberOfLines={1}
        >
          {lastMessage}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", marginLeft: 8, height: 48, justifyContent: "space-between" }}>
        <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{lastMessageTime}</Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isMuted && (
            <Ionicons name="notifications-off" size={17} color="#94A3B8" />
          )}
          {conversation.isPinned && (
            <MaterialCommunityIcons name="pin" size={19} color="#0068FF" style={{ transform: [{ rotate: "45deg" }] }} />
          )}

          {unreadCount > 0 && (
            <View
              style={{
                minWidth: 20,
                height: 20,
                paddingHorizontal: 6,
                backgroundColor: "#EF4444",
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
