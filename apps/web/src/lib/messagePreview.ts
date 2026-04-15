type PreviewContent = {
  text?: string;
  fileName?: string;
  mediaUrl?: string;
  callType?: string;
  callStatus?: string;
  duration?: number;
  status?: string;
};

type PreviewMetadata =
  | {
      isAnnouncement?: boolean;
      isImportant?: boolean;
    }
  | null
  | undefined;

type PreviewType =
  | "text"
  | "image"
  | "video"
  | "file"
  | "sticker"
  | "voice"
  | "call"
  | string;

type ParsedCallPayload = {
  callType: "audio" | "video";
  status: string;
};

const normalizeCallType = (
  value: unknown,
): ParsedCallPayload["callType"] | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "video") return "video";
  if (normalized === "audio" || normalized === "voice") return "audio";
  return null;
};

const normalizeCallStatus = (value: unknown): string | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return normalized === "ended" ? "finished" : normalized;
};

const parseCallPayloadObject = (
  value: Record<string, unknown>,
): ParsedCallPayload | null => {
  const callType = normalizeCallType(value.callType);
  const status = normalizeCallStatus(value.status || value.callStatus);
  if (!callType || !status) return null;
  return { callType, status };
};

const parseCallPayload = (
  content?: PreviewContent | string | null,
): ParsedCallPayload | null => {
  if (!content) return null;

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parseCallPayloadObject(parsed as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  const direct = parseCallPayloadObject(content as Record<string, unknown>);
  if (direct) return direct;
  return typeof content.text === "string" ? parseCallPayload(content.text) : null;
};

const getCallPreviewText = (payload: ParsedCallPayload) => {
  const suffix = payload.callType === "video" ? " video" : "";
  if (payload.status === "finished") return `Cuoc goi${suffix}`;
  if (payload.status === "missed") return `Cuoc goi nho${suffix}`;
  if (payload.status === "rejected") return "Cuoc goi bi tu choi";
  if (payload.status === "cancelled") return "Cuoc goi da huy";
  return payload.callType === "video" ? "Cuoc goi video" : "Cuoc goi";
};

export const getMessagePreviewText = ({
  type,
  content,
  metadata,
}: {
  type: PreviewType;
  content?: PreviewContent | string | null;
  metadata?: PreviewMetadata;
}) => {
  const text =
    typeof content === "string"
      ? content
      : typeof content?.text === "string"
        ? content.text
        : "";

  const callPayload = parseCallPayload(content);
  const callPreview =
    type === "call" || callPayload
      ? getCallPreviewText(
          callPayload || { callType: "audio", status: "finished" },
        )
      : "";

  const baseText =
    callPreview ||
    text ||
    (type === "image"
      ? "[Hinh anh]"
      : type === "video"
        ? "[Video]"
        : type === "voice"
          ? "[Tin nhan thoai]"
          : type === "sticker"
            ? "[Nhan dan]"
            : type === "file"
              ? `[File] ${
                  typeof content === "object" && content ? content.fileName || "" : ""
                }`.trim()
              : "[Tin nhan]");

  const prefixes = [
    metadata?.isImportant ? "[Quan trong]" : "",
    metadata?.isAnnouncement ? "[Thong bao]" : "",
  ].filter(Boolean);

  return [...prefixes, baseText].join(" ").trim();
};
