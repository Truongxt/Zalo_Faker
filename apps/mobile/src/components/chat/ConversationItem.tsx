import { View, Text, TouchableOpacity } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Conversation } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  onPress: () => void;
}

export function ConversationItem({
  conversation,
  currentUserId,
  onPress,
}: ConversationItemProps) {
  return <View className="relative"></View>;
}
