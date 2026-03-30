import { Avatar } from "@/components/ui/Avatar";
import { Colors } from "@/constants/colors";
import type { Message as ChatMessage } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Text, View } from "react-native";

interface MessageProps {
  message: ChatMessage;
  isSent?: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  showTime?: boolean;
}

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Vua xong";
  }

  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: vi,
  });
};

const formatAttachmentLabel = (
  attachment: NonNullable<ChatMessage["attachments"]>[number],
) => {
  switch (attachment.type) {
    case "image":
      return attachment.name || "Hinh anh";
    case "video":
      return attachment.name || "Video";
    case "voice":
      return attachment.name || "Tin nhan giong noi";
    default:
      return attachment.name || "Tap tin";
  }
};

export function Message({
  message,
  isSent = false,
  showAvatar = !isSent,
  showSenderName = !isSent,
  showTime = true,
}: MessageProps) {
  const bubbleBackground = isSent ? Colors.bubbleSent : Colors.bubbleReceived;
  const bubbleTextColor = isSent
    ? Colors.bubbleSentText
    : Colors.bubbleReceivedText;
  const attachments = message.attachments || [];
  const reactions = message.reactions || [];
  const content = message.isDeleted
    ? "Tin nhan da bi thu hoi"
    : message.content;

  return (
    <View className={`mb-3 px-3 ${isSent ? "items-end" : "items-start"}`}>
      {showTime ? (
        <Text className="mb-1 text-xs text-gray-400">
          {formatRelativeTime(message.createdAt)}
        </Text>
      ) : null}

      <View
        className={`max-w-[88%] flex-row items-end ${isSent ? "flex-row-reverse" : ""}`}
      >
        {showAvatar ? (
          <View className={isSent ? "ml-2" : "mr-2"}>
            <Avatar
              name={message.senderName}
              uri={message.senderAvatar}
              size={32}
            />
          </View>
        ) : null}

        <View className="shrink">
          {showSenderName ? (
            <Text
              className={`mb-1 text-xs font-medium text-gray-500 ${isSent ? "text-right" : "text-left"}`}
            >
              {message.senderName}
            </Text>
          ) : null}

          {message.replyTo ? (
            <View
              className={`mb-2 rounded-2xl border px-3 py-2 ${isSent ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-100"}`}
            >
              <Text className="text-xs font-semibold text-gray-500">
                Tra loi {message.replyTo.senderName}
              </Text>
              <Text className="mt-1 text-sm text-gray-600" numberOfLines={2}>
                {message.replyTo.content}
              </Text>
            </View>
          ) : null}

          <View
            className="rounded-[22px] px-4 py-3"
            style={{ backgroundColor: bubbleBackground }}
          >
            {message.type !== "text" && !message.isDeleted ? (
              <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {message.type}
              </Text>
            ) : null}

            <Text
              className={`text-[15px] leading-5 ${message.isDeleted ? "italic text-gray-500" : ""}`}
              style={{ color: bubbleTextColor }}
            >
              {content || "Khong co noi dung"}
            </Text>

            {attachments.length ? (
              <View className="mt-3 gap-2">
                {attachments.map((attachment, index) => (
                  <View
                    key={`${message.id}-attachment-${index}`}
                    className="rounded-2xl border border-black/5 bg-white/60 px-3 py-2"
                  >
                    <Text className="text-sm font-medium text-gray-700">
                      {formatAttachmentLabel(attachment)}
                    </Text>
                    {attachment.size ? (
                      <Text className="mt-1 text-xs text-gray-500">
                        {Math.round(attachment.size / 1024)} KB
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <View
              className={`mt-2 flex-row items-center ${isSent ? "justify-end" : "justify-start"}`}
            >
              {message.isEdited && !message.isDeleted ? (
                <Text className="text-[11px] text-gray-500">Da chinh sua</Text>
              ) : null}
            </View>
          </View>

          {reactions.length ? (
            <View
              className={`mt-2 flex-row flex-wrap gap-2 ${isSent ? "justify-end" : "justify-start"}`}
            >
              {reactions.map((reaction, index) => (
                <View
                  key={`${message.id}-reaction-${reaction.emoji}-${reaction.userId}-${index}`}
                  className="rounded-full border border-gray-200 bg-white px-2 py-1"
                >
                  <Text className="text-xs text-gray-700">
                    {reaction.emoji} {reaction.userName}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
