import { Message as ChatMessage } from "@/components/chat/Message";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
}

export function MessageBubble({ message, isSent }: MessageBubbleProps) {
  return <ChatMessage message={message} isSent={isSent} />;
}
