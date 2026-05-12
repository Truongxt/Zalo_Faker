import { useState, useRef, useEffect } from "react";
import { Message } from "@/stores/chatStore";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Check,
  CheckCheck,
  Reply,
  SmilePlus,
  Trash2,
  Share,
  Pin,
  Phone,
  Video,
} from "lucide-react";
import VoicePlayer from "./VoicePlayer";

interface MessageBubbleProps {
  message: Message;
  isSent: boolean;
  showAvatar?: boolean;
  senderName?: string;
  senderAvatar?: string;
  replyMessage?: Message | null;
  replySenderName?: string;
  onReply?: () => void;
  onRecall?: () => void;
  onReact?: (emoji: string) => void;
  onForward?: () => void;
  onPin?: () => void;
  canPin?: boolean;
  participants?: Array<{ userId: string; fullName?: string }>;
  isGroupChat?: boolean;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

type NormalizedContent = {
  text?: string;
  mediaUrl?: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  transcript?: string;
  callType?: "audio" | "video";
  callStatus?: string;
};

type FilePreviewKind = "pdf" | "text";

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
  const normalized = String(fileName || "")
    .trim()
    .toLowerCase();
  const segments = normalized.split(".");
  if (segments.length < 2) return "";
  return segments.pop() || "";
};

const getPreviewKind = (
  fileName?: string,
  mediaUrl?: string,
): FilePreviewKind | null => {
  const resolvedFileName = String(
    fileName || getFileNameFromUrl(mediaUrl),
  ).trim();
  const extension = getFileExtension(resolvedFileName);

  if (extension === "pdf") return "pdf";
  if (TEXT_FILE_EXTENSIONS.has(extension)) return "text";

  return null;
};

const normalizeContent = (rawContent: any): NormalizedContent => {
  if (typeof rawContent === "string") {
    return { text: rawContent };
  }

  if (!rawContent || typeof rawContent !== "object") {
    return {};
  }

  return {
    text:
      typeof rawContent.text === "string"
        ? rawContent.text
        : typeof rawContent.message === "string"
          ? rawContent.message
          : typeof rawContent.content === "string"
            ? rawContent.content
            : undefined,
    mediaUrl:
      typeof rawContent.mediaUrl === "string"
        ? rawContent.mediaUrl
        : typeof rawContent.url === "string"
          ? rawContent.url
          : typeof rawContent.fileUrl === "string"
            ? rawContent.fileUrl
            : undefined,
    thumbnail:
      typeof rawContent.thumbnail === "string"
        ? rawContent.thumbnail
        : undefined,
    fileName:
      typeof rawContent.fileName === "string" ? rawContent.fileName : undefined,
    fileSize:
      typeof rawContent.fileSize === "number" ? rawContent.fileSize : undefined,
    duration:
      typeof rawContent.duration === "number" ? rawContent.duration : undefined,
    callType:
      rawContent.callType === "video"
        ? "video"
        : rawContent.callType === "audio" || rawContent.callType === "voice"
          ? "audio"
          : undefined,
    callStatus:
      typeof rawContent.callStatus === "string"
        ? rawContent.callStatus
        : typeof rawContent.status === "string"
          ? rawContent.status
          : undefined,
  };
};

type ParsedCallPayload = {
  callType: "audio" | "video";
  status: string;
  duration: number;
};

type FilePreviewTarget = {
  name: string;
  fileUrl: string;
  previewUrl: string;
};

const OFFICE_EXTENSIONS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

const getFileExtension = (value: string) => {
  const cleanValue = value.split("?")[0].split("#")[0];
  const parts = cleanValue.split(".");
  if (parts.length < 2) return "";
  return String(parts[parts.length - 1] || "")
    .trim()
    .toLowerCase();
};

const getFileNameFromUrl = (url: string) => {
  const cleanUrl = url.split("?")[0];
  const lastSegment = cleanUrl.split("/").pop() || "Tep dinh kem";
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
};

const buildFilePreviewTarget = (
  fileUrl?: string,
  fileName?: string,
): FilePreviewTarget | null => {
  const normalizedUrl = String(fileUrl || "").trim();
  if (!normalizedUrl || !/^https?:\/\//i.test(normalizedUrl)) return null;

  const resolvedName =
    String(fileName || "").trim() || getFileNameFromUrl(normalizedUrl);
  const ext = getFileExtension(resolvedName || normalizedUrl);

  if (ext === "pdf") {
    return {
      name: resolvedName,
      fileUrl: normalizedUrl,
      previewUrl: normalizedUrl,
    };
  }

  if (OFFICE_EXTENSIONS.has(ext)) {
    return {
      name: resolvedName,
      fileUrl: normalizedUrl,
      previewUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(normalizedUrl)}`,
    };
  }

  return null;
};

const normalizeCallType = (
  value: unknown,
): ParsedCallPayload["callType"] | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "audio" || normalized === "voice") return "audio";
  return null;
};

const normalizeCallStatus = (value: unknown): string | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return normalized === "ended" ? "finished" : normalized;
};

const parseCallPayloadFromObject = (
  value: Record<string, unknown>,
): ParsedCallPayload | null => {
  const callType = normalizeCallType(value.callType);
  const status = normalizeCallStatus(value.status || value.callStatus);
  if (!callType || !status) return null;

  const duration =
    typeof value.duration === "number" && Number.isFinite(value.duration)
      ? Math.max(0, Math.floor(value.duration))
      : 0;

  return { callType, status, duration };
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
export default function MessageBubble({
  message,
  isSent,
  showAvatar = false,
  senderName,
  senderAvatar,
  replyMessage,
  replySenderName,
  onReply,
  onRecall,
  onReact,
  onForward,
  onPin,
  canPin = false,
  participants = [],
  isGroupChat = false,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showConfirmRecall, setShowConfirmRecall] = useState(false);
  const [showVoiceTranscript, setShowVoiceTranscript] = useState(false);
  const [activeFilePreview, setActiveFilePreview] =
    useState<FilePreviewTarget | null>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const isAnnouncement = Boolean(message.metadata?.isAnnouncement);
  const isForwarded = Boolean(message.metadata?.isForwarded);
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const readBy = Array.isArray(message.readBy) ? message.readBy : [];
  const content = normalizeContent(message.content);
  const parsedCallPayload =
    parseCallPayload(content) ||
    parseCallPayload(message.content) ||
    (message.type === "call"
      ? { callType: "audio" as const, status: "finished", duration: 0 }
      : null);
  const transcriptStatus = String(
    message.metadata?.transcriptStatus || "",
  ).toLowerCase();
  const transcriptText = String(
    content.transcript || message.metadata?.transcript || "",
  ).trim();
  const filePreviewTarget = buildFilePreviewTarget(
    content.mediaUrl,
    content.fileName,
  );
  const fileNameLabel =
    content.fileName || getFileNameFromUrl(content.mediaUrl || "");

  const transcriptLabel =
    transcriptText ||
    (transcriptStatus === "failed"
      ? "Hệ thống chưa tách được text. Đang thử lại ở lần tải tiếp theo."
      : transcriptStatus === "disabled"
        ? "Tính năng tách text đang tắt trên server."
        : transcriptStatus === "missing_audio_url"
          ? "Không tìm thấy file ghi âm để tách text."
          : transcriptStatus === "empty"
            ? "Không nhận diện được nội dung từ file ghi âm này."
            : "Đang xử lý tách text cho đoạn ghi âm...");

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getCallStatusText = (status: string, callType: "audio" | "video") => {
    const suffix = callType === "video" ? " video" : "";
    if (status === "finished") {
      return isSent ? `Cuộc gọi đến${suffix}` : `Cuộc gọi đến${suffix}`;
    }
    if (status === "missed") {
      return isSent ? "Thue bao khong nhac may" : `Cuoc goi nho${suffix}`;
    }
    if (status === "rejected") return "Cuoc goi bi tu choi";
    if (status === "cancelled") return "Cuoc goi da huy";
    return callType === "video" ? "Cuoc goi video" : "Cuoc goi";
  };

  const renderCallContent = () => {
    const payload = parsedCallPayload;
    if (!payload) {
      return (
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
          {content.text || "Cuoc goi"}
        </p>
      );
    }

    const isMissed =
      payload.status === "missed" || payload.status === "rejected";
    const CallIcon = payload.callType === "video" ? Video : Phone;

    return (
      <div className="flex items-center gap-3 min-w-[220px]">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${isMissed ? "bg-red-100/80 text-red-500 dark:bg-red-900/30 dark:text-red-300" : "bg-black/10 text-primary-600 dark:bg-white/10 dark:text-primary-300"}`}
        >
          <CallIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">
            {getCallStatusText(payload.status, payload.callType)}
          </p>
          {payload.status === "finished" && (
            <p className="text-xs opacity-70">
              {formatCallDuration(payload.duration)}
            </p>
          )}
          {isMissed && !isSent && (
            <p className="text-xs font-medium text-red-500 dark:text-red-300">
              Nhấn để gọi lại
            </p>
          )}
        </div>
      </div>
    );
  };

  // Format read receipt info for tooltip
  const getReadReceiptInfo = () => {
    if (!isSent || readBy.length === 0) return "";

    const readUsers = readBy
      .map((r) => {
        const participant = participants.find((p) => p.userId === r.userId);
        return {
          name: participant?.fullName || "Người dùng",
          time: new Date(r.readAt),
        };
      })
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    if (readUsers.length === 0) return "";

    let tooltip = "✓ ";
    if (isGroupChat && participants.length > 0) {
      // For group chats show count
      if (readUsers.length === participants.length) {
        tooltip += `Tất cả đã đọc`;
      } else {
        tooltip += `${readUsers.length}/${participants.length} người đã đọc`;
      }
    } else {
      // For private chats show person name
      tooltip += `${readUsers[0].name} đã đọc`;
    }

    // Add times for first few people
    tooltip +=
      "\n" +
      readUsers
        .slice(0, 3)
        .map((u) => {
          const timeStr = u.time.toLocaleTimeString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `${u.name} · ${timeStr}`;
        })
        .join("\n");

    if (readUsers.length > 3) {
      tooltip += `\n...và ${readUsers.length - 3} người khác`;
    }

    return tooltip;
  };

  // Click outside → đóng reaction picker
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        reactionRef.current &&
        !reactionRef.current.contains(e.target as Node)
      ) {
        setShowReactionPicker(false);
      }
      if (
        confirmRef.current &&
        !confirmRef.current.contains(e.target as Node)
      ) {
        setShowConfirmRecall(false);
      }
    };
    if (showReactionPicker || showConfirmRecall) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReactionPicker, showConfirmRecall]);

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
          throw new Error(`Cannot load file (${response.status})`);
        }

        const text = await response.text();
        setTextPreviewContent(text);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Không thể tải nội dung file";
        setTextPreviewError(message);
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

  useEffect(() => {
    if (!activeFilePreview) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveFilePreview(null);
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
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

  const renderContent = () => {
    if (message.type === "call" || parsedCallPayload) {
      return renderCallContent();
    }

    switch (message.type) {
      case "image":
        return (
          <div className="relative group">
            <img
              src={content.mediaUrl}
              alt="Image"
              className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
            />
            {content.text && (
              <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
                {content.text}
              </p>
            )}
          </div>
        );

      case "video":
        return (
          <div className="relative group">
            <video
              src={
                String(content.mediaUrl || "") +
                (String(content.mediaUrl || "").includes("#t=")
                  ? ""
                  : "#t=0.001")
              }
              poster={content.thumbnail}
              controls
              className="max-w-[300px] rounded-lg"
            />
            {content.text && (
              <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
                {content.text}
              </p>
            )}
          </div>
        );

      case "file":
        const resolvedFileName =
          content.fileName || getFileNameFromUrl(content.mediaUrl) || "File";
        const previewKind = getPreviewKind(resolvedFileName, content.mediaUrl);
        const mediaUrl = String(content.mediaUrl || "");

        return (
          <div className="flex flex-col gap-2">
            {content.text && (
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
                {content.text}
              </p>
            )}

            <div className="flex items-center gap-3 p-3 bg-black/10 dark:bg-white/10 rounded-lg">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                {fileNameLabel?.split(".").pop()?.toUpperCase() || "FILE"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{fileNameLabel}</p>
                <p className="text-sm opacity-70">
                  {content.fileSize
                    ? `${(content.fileSize / 1024).toFixed(1)} KB`
                    : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {filePreviewTarget && (
                <button
                  onClick={() => setActiveFilePreview(filePreviewTarget)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                  type="button"
                >
                  Xem trước
                </button>
              )}

              {content.mediaUrl && (
                <a
                  href={content.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                >
                  Mở file
                </a>
              )}
            </div>
          </div>
        );

      case "sticker":
        return (
          <img
            src={content.mediaUrl}
            alt="Sticker"
            className="w-32 h-32 object-contain"
          />
        );

      case "voice":
        return (
          <div className="flex flex-col gap-2 min-w-[220px] max-w-[300px]">
            <VoicePlayer
              src={content.mediaUrl || ""}
              duration={content.duration}
            />

            <div className="flex justify-end">
              <button
                onClick={() => setShowVoiceTranscript((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
              >
                Text
                <span>{showVoiceTranscript ? "▲" : "▼"}</span>
              </button>
            </div>

            {showVoiceTranscript && (
              <div className="border-t border-black/10 dark:border-white/10 pt-2">
                <p className="text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
                  {transcriptLabel}
                </p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
            {content.text}
          </p>
        );
    }
  };

  if (message.isDeleted) {
    return (
      <div className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
        <div className="message-bubble bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic">
          Tin nhắn đã bị xóa
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`flex ${isSent ? "justify-end" : "justify-start"} group mb-4`}
      >
        <div
          className={`flex ${isSent ? "justify-end" : "justify-start"} group mb-4`}
        >
          <div
            className={`flex items-end gap-2 max-w-[75%] ${isSent ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar for received messages */}
            {!isSent &&
              showAvatar &&
              (senderAvatar ? (
                <img
                  src={senderAvatar}
                  alt={senderName || ""}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                    {(senderName || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
              ))}
            {!isSent && !showAvatar && <div className="w-8" />}

            <div
              className={`flex flex-col relative ${isSent ? "items-end" : "items-start"} max-w-full`}
            >
              {/* Reply reference */}
              {replyMessage && (
                <div
                  className={`mb-1 px-3 py-1.5 rounded-lg text-xs bg-black/5 dark:bg-white/5 border-l-2 border-primary-500 ${isSent ? "ml-auto" : "mr-auto"} max-w-full`}
                >
                  <p className="font-medium text-primary-500 truncate">
                    {replySenderName || "Người dùng"}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 truncate">
                    {replyMessage.isDeleted
                      ? "Tin nhắn đã bị xóa"
                      : replyMessage.content?.text || "[Media]"}
                  </p>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`message-bubble ${isSent ? "message-sent" : "message-received"} ${isAnnouncement ? "border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-900/20" : ""}`}
              >
                {isForwarded && (
                  <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/70 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <Share className="w-3 h-3" />
                    Đã chuyển tiếp
                  </div>
                )}
                {isAnnouncement && (
                  <div className="mb-1.5 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Thông báo
                  </div>
                )}
                {renderContent()}
              </div>

              {/* Reactions display */}
              {reactions.length > 0 && (
                <div
                  className={`flex gap-0.5 mt-0.5 ${isSent ? "justify-end" : "justify-start"}`}
                >
                  <div className="flex items-center gap-0.5 bg-white dark:bg-dark-300 rounded-full px-1.5 py-0.5 shadow-sm border border-gray-100 dark:border-gray-700">
                    {[...new Set(reactions.map((r) => r.emoji))]
                      .slice(0, 3)
                      .map((emoji, i) => (
                        <span key={i} className="text-sm">
                          {emoji}
                        </span>
                      ))}
                    {reactions.length > 1 && (
                      <span className="text-xs text-gray-500 ml-0.5">
                        {reactions.length}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Time and status */}
              <div
                className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}
              >
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(new Date(message.createdAt), {
                    addSuffix: false,
                    locale: vi,
                  })}
                </span>
                {isSent && (
                  <div
                    className="group/receipt relative"
                    title={readBy.length > 0 ? getReadReceiptInfo() : "Đã gửi"}
                  >
                    {readBy.length > 0 ? (
                      <>
                        <CheckCheck className="w-3 h-3 text-primary-500 cursor-help" />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover/receipt:block z-50">
                          <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                            {isGroupChat && participants.length > 0 ? (
                              readBy.length === participants.length ? (
                                <span>
                                  {readBy.length === 1
                                    ? `1 người đã đọc`
                                    : `Tất cả ${readBy.length} người đã đọc`}
                                </span>
                              ) : (
                                <span>
                                  {readBy.length}/{participants.length} người đã
                                  đọc
                                </span>
                              )
                            ) : (
                              <span>Đã được đọc</span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <Check className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions (shown on hover) */}
            <div
              className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isSent ? "flex-row-reverse" : ""}`}
            >
              <button
                onClick={onReply}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Trả lời"
              >
                <Reply className="w-4 h-4 text-gray-500" />
              </button>

              {!message.isDeleted && (
                <button
                  onClick={onForward}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Chuyển tiếp"
                >
                  <Share className="w-4 h-4 text-gray-500" />
                </button>
              )}

              {!message.isDeleted && canPin && (
                <button
                  onClick={onPin}
                  className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-full transition-colors"
                  title="Ghim tin nhắn"
                >
                  <Pin className="w-4 h-4 text-yellow-500" />
                </button>
              )}

              {/* Reaction button with mini picker */}
              <div className="relative" ref={reactionRef}>
                <button
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Thả cảm xúc"
                >
                  <SmilePlus className="w-4 h-4 text-gray-500" />
                </button>

                {/* Quick reaction picker */}
                {showReactionPicker && (
                  <div
                    className={`absolute bottom-full mb-1 z-50 ${isSent ? "right-0" : "left-0"}`}
                  >
                    <div className="flex items-center gap-1 bg-white dark:bg-dark-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 animate-scale-in">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            onReact?.(emoji);
                            setShowReactionPicker(false);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-transform hover:scale-125 text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recall button — chỉ hiện với tin nhắn của mình */}
              {isSent && !message.isDeleted && (
                <div className="relative" ref={confirmRef}>
                  <button
                    onClick={() => setShowConfirmRecall(true)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                    title="Thu hồi tin nhắn"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>

                  {/* Confirm recall dialog */}
                  {showConfirmRecall && (
                    <div
                      className={`absolute bottom-full mb-1 z-50 ${isSent ? "right-0" : "left-0"}`}
                    >
                      <div className="bg-white dark:bg-dark-300 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[200px] animate-scale-in">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                          Thu hồi tin nhắn này?
                        </p>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setShowConfirmRecall(false)}
                            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={() => {
                              onRecall?.();
                              setShowConfirmRecall(false);
                            }}
                            className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                          >
                            Thu hồi
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeFilePreview && (
        <div
          className="fixed inset-0 z-[1000] bg-black/60 p-4 md:p-8 flex items-center justify-center"
          onClick={() => setActiveFilePreview(null)}
        >
          <div
            className="w-full max-w-6xl h-[88vh] bg-white dark:bg-dark-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {activeFilePreview.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Xem truoc tep dinh kem
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activeFilePreview.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                >
                  Mở file
                </a>

                <button
                  type="button"
                  onClick={() => setActiveFilePreview(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Dong
                </button>
              </div>
            </div>

            <iframe
              src={activeFilePreview.previewUrl}
              title={`file-preview-${message.id}`}
              className="flex-1 w-full bg-gray-50 dark:bg-gray-900"
            />
          </div>
        </div>
      )}
    </>
  );
}
