import { View, Text, TouchableOpacity } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Conversation } from "@/types";

interface ChatHeaderProps {
  conversation: Conversation | null;
  currentUserId: string;
  onBack: () => void;
  onCall: () => void;
  onVideoCall: () => void;
  onInfo: () => void;
}

export function ChatHeader({
  conversation,
  currentUserId,
  onBack,
  onCall,
  onVideoCall,
  onInfo,
}: ChatHeaderProps) {
  return (
    <View className="flex-row items-center px-2 h-14 bg-white border-b border-gray-100"></View>
  );
}
