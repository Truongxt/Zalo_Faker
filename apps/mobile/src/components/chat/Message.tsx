import { Avatar } from "@/components/ui/Avatar";
import { Colors } from "@/constants/colors";
import type { Message as ChatMessage } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useState } from "react";
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

type FilePreviewKind = "pdf" | "text";

type FilePreviewState = {
  kind: FilePreviewKind;
  mediaUrl: string;
  fileName: string;
};

const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "log",
  "csv",
  "json",
  "xml",
  "yaml",
  "yml",
]);

const getFileNameFromUrl = (url?: string) => {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").pop() || "";
    return decodeURIComponent(lastSegment);
  } catch {
    const clean = String(url).split("?")[0].split("#")[0];
    const lastSegment = clean.split("/").pop() || "";
    return decodeURIComponent(lastSegment);
  }
};

const getFileExtension = (fileName: string) => {
  const normalized = String(fileName || "").trim().toLowerCase();
  const segments = normalized.split(".");
  if (segments.length < 2) return "";
  return segments.pop() || "";
};

const getPreviewKind = (
  fileName?: string,
  mediaUrl?: string,
): FilePreviewKind | null => {
  const resolvedFileName = String(fileName || getFileNameFromUrl(mediaUrl)).trim();
  const extension = getFileExtension(resolvedFileName);

  if (extension === "pdf") return "pdf";
  if (TEXT_FILE_EXTENSIONS.has(extension)) return "text";

  return null;
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
  const isForwarded = Boolean(message.metadata?.isForwarded);
  const content = message.isDeleted
    ? "Tin nhan da bi thu hoi"
    : message.content;
  const [activeFilePreview, setActiveFilePreview] = useState<FilePreviewState | null>(null);
  const [textPreviewContent, setTextPreviewContent] = useState("");
  const [textPreviewLoading, setTextPreviewLoading] = useState(false);
  const [textPreviewError, setTextPreviewError] = useState("");

  useEffect(() => {
    if (!activeFilePreview || activeFilePreview.kind !== "text") return;

    const controller = new AbortController();

    const loadTextPreview = async () => {
      setTextPreviewLoading(true);
      setTextPreviewError("");
      setTextPreviewContent("");

      try {
        const response = await fetch(activeFilePreview.mediaUrl, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Khong the tai file (${response.status})`);
        }

        const text = await response.text();
        setTextPreviewContent(text);
      } catch (error) {
        if (controller.signal.aborted) return;
        setTextPreviewError(
          error instanceof Error ? error.message : "Khong the tai noi dung file",
        );
      } finally {
        if (!controller.signal.aborted) {
          setTextPreviewLoading(false);
        }
      }
    };

    loadTextPreview();

    return () => {
      controller.abort();
    };
  }, [activeFilePreview]);

  const openFilePreview = (
    kind: FilePreviewKind,
    mediaUrl: string,
    fileName: string,
  ) => {
    setActiveFilePreview({ kind, mediaUrl, fileName });
  };

  const closeFilePreview = () => {
    setActiveFilePreview(null);
    setTextPreviewContent("");
    setTextPreviewLoading(false);
    setTextPreviewError("");
  };

  const handleOpenFileExternally = async (mediaUrl: string) => {
    if (!mediaUrl) return;

    try {
      await Linking.openURL(mediaUrl);
    } catch {
      setTextPreviewError("Khong the mo file nay");
    }
  };

  const parsedCallPayload =
    parseCallPayload(content) ||
    (message.type === "call"
      ? { callType: "audio" as const, status: "finished", duration: 0 }
      : null);

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
                  if (status === 'missed') return isSent ? 'Thue bao khong nhac may' : 'Cuộc gọi nhỡ';
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
                </View>

                <Modal
                  visible={Boolean(activeFilePreview)}
                  transparent
                  animationType="fade"
                  onRequestClose={closeFilePreview}
                >
                  <Pressable
                    onPress={closeFilePreview}
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(0,0,0,0.65)",
                      padding: 16,
                      justifyContent: "center",
                    }}
                  >
                    <Pressable
                      onPress={() => undefined}
                      style={{
                        maxHeight: "88%",
                        borderRadius: 24,
                        backgroundColor: Colors.background,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: "rgba(0,0,0,0.08)",
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }} numberOfLines={1}>
                            Xem trước: {activeFilePreview?.fileName}
                          </Text>
                          <Text style={{ fontSize: 12, color: Colors.textMuted }} numberOfLines={1}>
                            {activeFilePreview?.kind === "pdf"
                              ? "PDF được mở ngoài app nếu thiết bị không hỗ trợ xem trực tiếp"
                              : "Nội dung file văn bản"}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={closeFilePreview}
                          style={{
                            minWidth: 72,
                            height: 36,
                            borderRadius: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: Colors.primary,
                          }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Đóng</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={{ flex: 1, minHeight: 240, padding: 16 }}>
                        {activeFilePreview?.kind === "pdf" ? (
                          <View
                            style={{
                              flex: 1,
                              borderRadius: 18,
                              borderWidth: 1,
                              borderColor: "rgba(0,0,0,0.08)",
                              backgroundColor: "rgba(0,0,0,0.03)",
                              padding: 20,
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 12,
                            }}
                          >
                            <Ionicons name="document-text-outline" size={44} color={Colors.textMuted} />
                            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text, textAlign: "center" }}>
                              Xem trước PDF
                            </Text>
                            <Text style={{ fontSize: 13, color: Colors.textMuted, textAlign: "center", lineHeight: 19 }}>
                              Thiết bị này không hiển thị PDF trực tiếp trong modal. Bạn có thể mở file ở tab hoặc ứng dụng khác.
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                if (activeFilePreview?.mediaUrl) {
                                  handleOpenFileExternally(activeFilePreview.mediaUrl);
                                }
                              }}
                              style={{
                                marginTop: 4,
                                paddingHorizontal: 16,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: Colors.primary,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: "#fff", fontWeight: "700" }}>Mở file ở tab mới</Text>
                            </TouchableOpacity>
                          </View>
                        ) : textPreviewLoading ? (
                          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={{ marginTop: 12, color: Colors.textMuted }}>Đang tải nội dung file...</Text>
                          </View>
                        ) : textPreviewError ? (
                          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
                            <Text style={{ color: "#dc2626", textAlign: "center", lineHeight: 20 }}>
                              Không thể xem trước file này: {textPreviewError}
                            </Text>
                            {activeFilePreview?.mediaUrl ? (
                              <TouchableOpacity
                                onPress={() => handleOpenFileExternally(activeFilePreview.mediaUrl)}
                                style={{
                                  paddingHorizontal: 16,
                                  height: 40,
                                  borderRadius: 20,
                                  backgroundColor: Colors.primary,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ color: "#fff", fontWeight: "700" }}>Mở file ở tab mới</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : (
                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: 8 }}
                          >
                            <View
                              style={{
                                borderRadius: 18,
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.08)",
                                backgroundColor: "rgba(0,0,0,0.03)",
                                padding: 16,
                              }}
                            >
                              <Text
                                selectable
                                style={{
                                  color: Colors.text,
                                  fontSize: 13,
                                  lineHeight: 20,
                                }}
                              >
                                {textPreviewContent || "File rong"}
                              </Text>
                            </View>
                          </ScrollView>
                        )}
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
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
                {message.type === "file" ? (
                  (() => {
                    const fileAttachment = attachments.find(
                      (attachment) => attachment.type === "file",
                    );
                    const mediaUrl = fileAttachment?.url || String(message.content || "");
                    const fileName =
                      fileAttachment?.name || getFileNameFromUrl(mediaUrl) || "File dinh kem";
                    const previewKind = getPreviewKind(fileName, mediaUrl);

                    return (
                      <View style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            if (previewKind && mediaUrl) {
                              openFilePreview(previewKind, mediaUrl, fileName);
                              return;
                            }

                            handleOpenFileExternally(mediaUrl);
                          }}
                          style={({ pressed }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            borderRadius: 14,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: pressed ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.16)",
                          })}
                        >
                          <Ionicons name="document-outline" size={18} color={bubbleTextColor} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={{ color: bubbleTextColor, fontWeight: "600" }}
                              numberOfLines={1}
                            >
                              {fileName}
                            </Text>
                            <Text
                              style={{ color: bubbleTextColor, opacity: 0.72, fontSize: 12 }}
                              numberOfLines={1}
                            >
                              {previewKind ? "Chạm để xem trước" : "Chạm để mở file"}
                            </Text>
                          </View>
                        </Pressable>

                        {previewKind && mediaUrl ? (
                          <Pressable onPress={() => handleOpenFileExternally(mediaUrl)}>
                            <Text
                              style={{
                                color: bubbleTextColor,
                                fontSize: 12,
                                textDecorationLine: "underline",
                              }}
                            >
                              Mở file ở tab mới
                            </Text>
                          </Pressable>
                        ) : null}
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
                      {content || "Khong co noi dung"}
                    </Text>
                  </>
                )}
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
