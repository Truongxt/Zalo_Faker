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

const getConversationName = (conversation: Conversation, currentUserId: string) => {
  if (conversation.type === "group") return conversation.name || "Nhóm chat";
  const partner = conversation.participants?.find(
    (p) => String(p.userId) !== String(currentUserId),
  );
  return partner?.fullName || "Người dùng";
};

const getConversationAvatar = (conversation: Conversation, currentUserId: string) => {
  if (conversation.type === "group") return conversation.avatarUrl;
  const partner = conversation.participants?.find(
    (p) => String(p.userId) !== String(currentUserId),
  );
  return partner?.avatarUrl || null;
};

const getLastMessageText = (conversation: Conversation) => {
  const content = conversation.lastMessage?.content;
  if (!content) return "Chưa có tin nhắn";
  return content;
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
  const activeLabels = allLabels.filter(l => labelIds.includes(l._id));

  // Visuals: Revert to standard colors, remove tint
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
      {/* Avatar Section */}
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

      {/* Main Content */}
      <View style={{ flex: 1, marginLeft: 14 }}>
        {/* Name and Label indicators Row */}
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
          {/* Label icons */}
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

        {/* Message preview Row */}
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

      {/* Right Column Status indicators */}
      <View style={{ alignItems: "flex-end", marginLeft: 8, height: 48, justifyContent: "space-between" }}>
        <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{lastMessageTime}</Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isMuted && (
            <Ionicons name="notifications-off" size={17} color="#94A3B8" />
          )}
          {conversation.isPinned && (
            <MaterialCommunityIcons name="pin" size={19} color="#0068FF" style={{ transform: [{ rotate: '45deg' }] }} />
          )}

          {unreadCount > 0 && (
            <View
              style={{
                minWidth: 20,
                height: 20,
                paddingHorizontal: 6,
                backgroundColor: "#EF4444", // Red for unread is more prominent
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
