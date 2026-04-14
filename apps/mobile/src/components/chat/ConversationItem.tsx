import { View, Text, TouchableOpacity } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Conversation } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  isOnline?: boolean;
  onPress: () => void;
}

const getConversationName = (
  conversation: Conversation,
  currentUserId: string,
) => {
  if (conversation.type === "group") {
    return conversation.name || "Nhom chat";
  }

  const partner = conversation.participants?.find(
    (p) => String(p.userId) !== String(currentUserId),
  );
  return partner?.fullName || "Nguoi dung";
};

const getConversationAvatar = (
  conversation: Conversation,
  currentUserId: string,
) => {
  if (conversation.type === "group") return conversation.avatarUrl;
  const partner = conversation.participants?.find(
    (p) => String(p.userId) !== String(currentUserId),
  );
  return partner?.avatarUrl || null;
};

const getLastMessageText = (conversation: Conversation) => {
  const content = conversation.lastMessage?.content;
  if (!content) return "Chua co tin nhan";
  return content;
};

const getLastMessageTime = (conversation: Conversation) => {
  const rawTime =
    (conversation.lastMessage as any)?.createdAt ||
    (conversation.lastMessage as any)?.timestamp;
  if (!rawTime) return "";

  try {
    return formatDistanceToNow(new Date(rawTime), {
      addSuffix: true,
      locale: vi,
    });
  } catch {
    return "";
  }
};

export function ConversationItem({
  conversation,
  currentUserId,
  isOnline = false,
  onPress,
}: ConversationItemProps) {
  const name = getConversationName(conversation, currentUserId);
  const avatar = getConversationAvatar(conversation, currentUserId);
  const lastMessage = getLastMessageText(conversation);
  const lastMessageTime = getLastMessageTime(conversation);
  const unreadCount = Number(conversation.unreadCount || 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="px-4 py-3 flex-row items-center border-b border-gray-100"
    >
      <View className="relative">
        <Avatar
          name={name}
          uri={avatar}
          size={48}
          isGroup={conversation.type === "group"}
        />
        {conversation.type !== "group" && isOnline ? (
          <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#22C55E] border-2 border-white" />
        ) : null}
      </View>

      <View className="flex-1 ml-3">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-gray-900 font-semibold text-base"
            numberOfLines={1}
          >
            {name}
          </Text>
          {lastMessageTime ? (
            <Text className="text-xs text-gray-400 ml-2">
              {lastMessageTime}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between mt-0.5">
          <Text
            className={`${unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-500"} text-sm flex-1 pr-2`}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>

          {unreadCount > 0 ? (
            <View className="min-w-5 h-5 px-1 bg-[#0068FF] rounded-full items-center justify-center">
              <Text className="text-white text-xs font-semibold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
