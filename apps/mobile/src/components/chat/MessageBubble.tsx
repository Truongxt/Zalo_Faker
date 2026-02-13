import { View, Text } from "react-native";
import { Message } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
}

export function MessageBubble({ message, isSent }: MessageBubbleProps) {
  return (
    <View
      className={`flex-row ${isSent ? "justify-end" : "justify-start"}`}
    ></View>
  );
}
