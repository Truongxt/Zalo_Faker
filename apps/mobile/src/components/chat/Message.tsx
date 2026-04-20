import { Avatar } from "@/components/ui/Avatar";
import { Colors } from "@/constants/colors";
import type { Message as ChatMessage } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    return "Vừa xong";
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
      return attachment.name || "Hình anh";
    case "video":
      return attachment.name || "Video";
    case "voice":
      return attachment.name || "Tin nhắn giọng nói";
    default:
      return attachment.name || "Tập tin";
  }
};

const parseCallPayload = (value: unknown) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parseCallPayload(parsed as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) return null;
  const objectValue = value as Record<string, unknown>;

  const callTypeRaw = String(objectValue.callType || "").trim().toLowerCase();
  const statusRaw = String(
    objectValue.status || objectValue.callStatus || "",
  ).trim().toLowerCase();
  if (!callTypeRaw || !statusRaw) return null;

  const callType =
    callTypeRaw === "video"
      ? "video"
      : callTypeRaw === "audio" || callTypeRaw === "voice"
        ? "audio"
        : null;
  if (!callType) return null;

  return {
    callType,
    status: statusRaw === "ended" ? "finished" : statusRaw,
    duration:
      typeof objectValue.duration === "number" && Number.isFinite(objectValue.duration)
        ? Math.max(0, Math.floor(objectValue.duration))
        : 0,
  };
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
  const isAnnouncement = Boolean(message.metadata?.isAnnouncement);
  const isForwarded = Boolean(message.metadata?.isForwarded);
  const content = message.isDeleted
    ? "Tin nhắn đã bị thu hồi"
    : message.content;
  const parsedCallPayload =
    parseCallPayload(content) ||
    (message.type === "call"
      ? { callType: "audio" as const, status: "finished", duration: 0 }
      : null);

  if (message.type === 'system' || isAnnouncement) {
    const action = (message.metadata as any)?.action;
    const isPinAction = action === 'pin' || action === 'unpin';
    
    const getIconName = () => {
      if (action === 'pin' || action === 'unpin') return 'pricetag';
      if (action === 'rename_group') return 'create';
      if (action === 'update_avatar') return 'image';
      if (action === 'add_member') return 'person-add';
      if (action === 'remove_member') return 'person-remove';
      if (action === 'update_permissions') return 'lock-closed';
      if (action === 'update_settings') return 'settings';
      return 'information-circle';
    };

    return (
      <View className="flex-row justify-center my-3 w-full">
        <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm flex-shrink-1">
          <View className={`w-6 h-6 rounded-full items-center justify-center ${isPinAction ? 'bg-orange-50' : 'bg-blue-50'}`}>
            <Ionicons name={getIconName() as any} size={12} color={isPinAction ? '#f97316' : '#3b82f6'} />
          </View>
          <Text className="text-sm text-gray-500 font-medium flex-shrink" numberOfLines={2}>
             {typeof message.content === 'object' ? (message.content as any)?.text || '' : String(message.content || '')}
          </Text>
        </View>
      </View>
    );
  }

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
                Trả lời {message.replyTo.senderName}
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
            {parsedCallPayload ? (
              (() => {
                const callData: any = parsedCallPayload;
                const isVideo = callData.callType === 'video';
                const status = callData.status;
                const duration = callData.duration || 0;

                const formatDuration = (s: number) => {
                  const mins = Math.floor(s / 60);
                  const secs = s % 60;
                  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                };

                const getStatusText = () => {
                  if (status === 'finished') return isSent ? 'Cuộc gọi đi' : 'Cuộc gọi đến';
                  if (status === 'missed') return isSent ? 'Thuê bao không nhấc máy' : 'Cuộc gọi nhỡ';
                  if (status === 'rejected') return 'Cuộc gọi bị từ chối';
                  if (status === 'cancelled') return 'Cuộc gọi đã hủy';
                  return 'Cuộc gọi';
                };

                const isMissed = status === 'missed' || status === 'rejected';

                return (
                  <View className="flex-row items-center gap-3 py-1">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: isMissed ? '#fee2e2' : '#dbeafe' }}
                    >
                      <Ionicons
                        name={isVideo ? "videocam" : "call"}
                        size={20}
                        color={isMissed ? "#ef4444" : "#3b82f6"}
                      />
                    </View>
                    <View>
                      <Text className="text-[15px] font-semibold" style={{ color: bubbleTextColor }}>
                        {getStatusText()}
                      </Text>
                      {status === 'finished' && (
                        <Text className="text-xs opacity-70" style={{ color: bubbleTextColor }}>
                          {formatDuration(duration)}
                        </Text>
                      )}
                      {isMissed && !isSent && (
                        <Text className="text-xs font-medium text-red-500">
                          Nhấn để gọi lại
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })()
            ) : (
              <>
                {message.type !== "text" && !message.isDeleted ? (
                  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {message.type}
                  </Text>
                ) : null}

                <Text
                  className={`text-[15px] leading-5 ${message.isDeleted ? "italic text-gray-500" : ""}`}
                  style={{ color: bubbleTextColor }}
                >
                  {content || "Không có nội dung"}
                </Text>
              </>
            )}

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
                <Text className="text-[11px] text-gray-500">Đã chỉnh sửa</Text>
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