import { socketService } from "@/lib/socket";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { API_URL } from "@/constants/config";
import type { Message, Conversation } from "@/types";
import apiClient from "./apiClient";
import { notificationService } from "./notificationService";

let isRealtimeInitialized = false;

const MEDIA_TYPES = new Set(["image", "video", "file", "voice"]);

const normalizeMediaUrl = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  if (!url) return undefined;

  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;

  if (url.startsWith("/")) return `${API_URL}${url}`;
  return `${API_URL}/${url}`;
};

const extractContentText = (rawContent: unknown): string => {
  if (typeof rawContent === "string") return rawContent;
  if (!rawContent || typeof rawContent !== "object") return "";

  const text =
    (rawContent as any).text
    || (rawContent as any).message
    || (rawContent as any).content;

  return typeof text === "string" ? text : "";
};

const extractContentMediaUrl = (rawContent: unknown): string | undefined => {
  if (!rawContent || typeof rawContent !== "object") {
    if (typeof rawContent === "string" && /^https?:\/\//i.test(rawContent)) {
      return rawContent;
    }
    return undefined;
  }

  return normalizeMediaUrl(
    (rawContent as any).mediaUrl
    || (rawContent as any).url
    || (rawContent as any).fileUrl,
  );
};

const normalizeCallType = (value: unknown): "audio" | "video" | null => {
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

const parseCallPayloadObject = (value: Record<string, unknown>) => {
  const callType = normalizeCallType(value.callType);
  const status = normalizeCallStatus(value.status || value.callStatus);
  if (!callType || !status) return null;

  return {
    callType,
    status,
    duration:
      typeof value.duration === "number" && Number.isFinite(value.duration)
        ? Math.max(0, Math.floor(value.duration))
        : 0,
  };
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
      return parseCallPayloadObject(parsed as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) return null;
  const objectValue = value as Record<string, unknown>;
  const direct = parseCallPayloadObject(objectValue);
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

const getReplyPreviewText = (message: Message | null | undefined): string => {
  if (!message) return "Tin nhan";
  if (message.isDeleted) return "Tin nhan da thu hoi";

  switch (message.type) {
    case "poll":
      return String((message.content as any)?.question || "").trim() || "[Binh chon]";
    case "image":
      return "[Hinh anh]";
    case "video":
      return "[Video]";
    case "voice":
      return "[Tin nhan thoai]";
    case "sticker":
      return "[Sticker]";
    case "file":
      return String(message.attachments?.[0]?.name || "").trim() || "[Tap tin]";
    default: {
      if (typeof message.content === "string" && message.content.trim()) {
        return message.content.trim();
      }

      if (message.content && typeof message.content === "object") {
        const nestedText = String(
          (message.content as any).text
            || (message.content as any).message
            || (message.content as any).content
            || "",
        ).trim();
        if (nestedText) return nestedText;
      }

      return "Tin nhan";
    }
  }
};

const getConversationPreviewText = (message: Message): string => {
  if (message.type === "poll") {
    return String((message.content as any)?.question || "").trim()
      ? `[Binh chon] ${String((message.content as any).question).trim()}`
      : "[Binh chon]";
  }

  return getReplyPreviewText(message);
};

const normalizeReplyTo = (
  replyTo: unknown,
  conversationId: string,
): Message["replyTo"] => {
  if (!replyTo) return null;

  if (typeof replyTo === "object" && !Array.isArray(replyTo)) {
    const replyObject = replyTo as Record<string, unknown>;
    const replyId = String(
      replyObject.id || replyObject._id || replyObject.messageId || "",
    ).trim();
    const replyContent = String(replyObject.content || "").trim();
    const replySenderName = String(
      replyObject.senderName || replyObject.fullName || "",
    ).trim();

    if (replyId || replyContent || replySenderName) {
      return {
        id: replyId || `reply-${Date.now()}`,
        content: replyContent || "Tin nhan",
        senderName: replySenderName || "Nguoi dung",
      };
    }
  }

  const replyId = String(replyTo).trim();
  if (!replyId) return null;

  const repliedMessage = (
    useChatStore.getState().messages[conversationId] || []
  ).find((message) => String(message.id) === replyId);

  return {
    id: replyId,
    content: getReplyPreviewText(repliedMessage),
    senderName: repliedMessage?.senderName || "Nguoi dung",
  };
};

const normalizeMessage = (msg: any): Message => {
  const type = (msg?.type || "text") as Message["type"];
  const rawContent = msg?.content;
  const contentText = extractContentText(rawContent);
  const contentMediaUrl = extractContentMediaUrl(rawContent);
  const rawMetadata = msg?.metadata && typeof msg.metadata === "object"
    ? msg.metadata
    : undefined;

  const attachmentFromPayload = Array.isArray(msg?.attachments)
    ? msg.attachments
      .map((attachment: any) => {
        const normalizedType = (attachment?.type || type) as any;
        if (!MEDIA_TYPES.has(String(normalizedType))) return null;

        const url = normalizeMediaUrl(
          attachment?.url || attachment?.mediaUrl || attachment?.fileUrl,
        );
        if (!url) return null;

        return {
          url,
          type: normalizedType,
          name: typeof attachment?.name === "string" ? attachment.name : undefined,
          size: typeof attachment?.size === "number" ? attachment.size : undefined,
          duration: typeof attachment?.duration === "number" ? attachment.duration : undefined,
          thumbnailUrl:
            typeof attachment?.thumbnailUrl === "string"
              ? attachment.thumbnailUrl
              : undefined,
          transcript:
            typeof attachment?.transcript === "string"
              ? attachment.transcript
              : typeof attachment?.text === "string"
                ? attachment.text
                : undefined,
        };
      })
      .filter(Boolean)
    : [];

  const inferredAttachment =
    attachmentFromPayload.length === 0
    && MEDIA_TYPES.has(type)
    && contentMediaUrl
      ? [{
          url: contentMediaUrl,
          type: type as "image" | "video" | "file" | "voice",
          name: typeof (rawContent as any)?.fileName === "string" ? (rawContent as any).fileName : undefined,
          size: typeof (rawContent as any)?.fileSize === "number" ? (rawContent as any).fileSize : undefined,
          duration: typeof (rawContent as any)?.duration === "number" ? (rawContent as any).duration : undefined,
          thumbnailUrl:
            typeof (rawContent as any)?.thumbnail === "string"
              ? (rawContent as any).thumbnail
              : undefined,
          transcript:
            typeof (rawContent as any)?.transcript === "string"
              ? (rawContent as any).transcript
              : typeof (rawMetadata as any)?.transcript === "string"
                ? (rawMetadata as any).transcript
                : undefined,
        }]
      : [];

  const parsedCallPayload = parseCallPayload(rawContent);
  let normalizedContent: any = contentText;
  if (
    type === "poll" &&
    rawContent &&
    typeof rawContent === "object" &&
    !Array.isArray(rawContent)
  ) {
    normalizedContent = rawContent;
  } else if (type === "call") {
    normalizedContent = parsedCallPayload || rawContent || "";
  } else if (!normalizedContent) {
    if (type === "voice") normalizedContent = "Tin nhan thoai";
    else if (contentMediaUrl) normalizedContent = contentMediaUrl;
    else normalizedContent = "";
  }

  const attachments = [...attachmentFromPayload, ...inferredAttachment];

  return {
    ...msg,
    id: msg?.id || msg?._id || `temp-${Date.now()}`,
    type,
    content: normalizedContent,
    attachments: attachments.length ? attachments : undefined,
    reactions: Array.isArray(msg?.reactions) ? msg.reactions : [],
    readBy: Array.isArray(msg?.readBy) ? msg.readBy : [],
    isDeleted: Boolean(msg?.isDeleted),
    isEdited: Boolean(msg?.isEdited),
    replyTo: normalizeReplyTo(
      msg?.replyTo,
      String(msg?.conversationId || msg?.conversation?.id || ""),
    ),
    senderName: msg?.senderName || "",
    senderAvatar: msg?.senderAvatar || null,
  };
};

const toServerContent = (type: Message["type"], content: string) => {
  if (type === "call") {
    return content;
  }

  if (type === "text") {
    return { text: content };
  }
  return { mediaUrl: content };
};

export async function uploadFile(
  uri: string,
  name: string,
  mimeType: string,
  accessToken: string | null,
  folder?: string,
  subfolder?: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", { uri, name, type: mimeType } as any);
  if (folder) formData.append("folder", folder);
  if (subfolder) formData.append("subfolder", subfolder);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload that bai");
  }

  const data = await response.json();
  return data.url as string;
}

export const chatService = {
  init() {
    if (isRealtimeInitialized) return;

    const socket = socketService.connect();
    if (!socket) return;
    isRealtimeInitialized = true;

    socketService.on("chat:message", (rawMessage: Message) => {
      const message = normalizeMessage(rawMessage);
      const { addMessage, updateConversation } = useChatStore.getState();
      addMessage(message.conversationId, message);

      updateConversation(message.conversationId, {
        lastMessage: {
          content: getConversationPreviewText(message),
          type: message.type,
          senderId: message.senderId,
          senderName: message.senderName,
          createdAt: message.createdAt,
          metadata: message.metadata,
        },
      });

      // Show notification if not in active conversation
      const { activeConversation } = useChatStore.getState();
      const { user } = useAuthStore.getState();
      
      if (
        String(message.senderId) !== String(user?.id) && 
        (!activeConversation || String(activeConversation.id) !== String(message.conversationId))
      ) {
        notificationService.showLocalNotification(
          message.senderName || "Tin nhan moi",
          getConversationPreviewText(message),
          { conversationId: message.conversationId },
          message.senderAvatar || undefined
        );
      }
    });

    socketService.on("video:incoming-call", (data: any) => {
      const { user } = useAuthStore.getState();
      if (String(data.callerId) === String(user?.id)) return;

      notificationService.showLocalNotification(
        "Cuoc goi den",
        `${data.callerName || "Ai do"} dang goi cho ban`,
        { callId: data.callId },
        data.callerAvatar || undefined
      );
    });

    socketService.on("chat:typing", ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { addTypingUser, removeTypingUser } = useChatStore.getState();
      addTypingUser(conversationId, userId);

      setTimeout(() => {
        removeTypingUser(conversationId, userId);
      }, 3000);
    });

    socketService.on("chat:read", ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      const { updateMessage } = useChatStore.getState();
      updateMessage(conversationId, messageId, {});
    });

    socketService.on("chat:recalled", ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      const { updateMessage } = useChatStore.getState();
      updateMessage(conversationId, messageId, { isDeleted: true });
    });

    socketService.on("chat:reaction", ({ messageId, conversationId, reactions }: { messageId: string; conversationId: string; reactions: any[] }) => {
      const state = useChatStore.getState();
      
      // If we have conversationId, update directly
      if (conversationId) {
        state.updateMessage(conversationId, messageId, { reactions });
        return;
      }

      // Fallback: search across all conversations if conversationId is missing
      for (const [convId, messages] of Object.entries(state.messages)) {
        const msg = (messages as Message[]).find((m) => m.id === messageId);
        if (msg) {
          state.updateMessage(convId, messageId, { reactions });
          break;
        }
      }
    });

    socketService.on("chat:message_updated", ({ conversationId, message }: { conversationId: string; message: any }) => {
      if (!conversationId || !message) return;
      const normalized = normalizeMessage(message);
      useChatStore.getState().updateMessage(conversationId, normalized.id, normalized);
    });

    socket.on("chat:update_conversation", ({ id, ...updates }: { id: string; [key: string]: any }) => {
      if (!id || !updates || Object.keys(updates).length === 0) return;
      useChatStore.getState().updateConversation(String(id), updates);
    });

    const handleConversationRemoved = ({
      conversationId,
    }: {
      conversationId?: string;
    }) => {
      const targetId = String(conversationId || "").trim();
      if (!targetId) return;
      useChatStore.getState().removeConversation(targetId);
    };

    socket.on("chat:conversation_removed", handleConversationRemoved);
    socket.on("group:dissolved", handleConversationRemoved);
  },

  async loadConversations() {
    const { setConversations, setLoadingConversations } = useChatStore.getState();
    const { user } = useAuthStore.getState();

    setLoadingConversations(true);

    try {
      const response = await apiClient.get<Conversation[]>("/api/conversations");
      // Derive isPinned from current user's participant (server stores per-participant)
      const conversations = response.data.map((conv) => {
        const myParticipant = conv.participants?.find(
          (p) => String(p.userId) === String(user?.id)
        ) as any;
        return {
          ...conv,
          isPinned: myParticipant?.isPinned ?? conv.isPinned ?? false,
        };
      });
      setConversations(conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  },

  async loadMessages(conversationId: string, before?: string) {
    const { setMessages, setLoadingMessages } = useChatStore.getState();

    setLoadingMessages(true);

    try {
      let url = `/api/messages/conversation/${conversationId}`;
      if (before) url += `?before=${encodeURIComponent(before)}`;

      const response = await apiClient.get<any[]>(url);
      const messages: Message[] = response.data.map(normalizeMessage);
      setMessages(conversationId, messages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  },

  async sendMessage(
    conversationId: string,
    data: {
      type: Message["type"];
      content: any;
      attachments?: any[];
      replyTo?: string;
      metadata?: any;
    },
  ): Promise<Message | undefined> {
    const { accessToken, user } = useAuthStore.getState();
    const { addMessage, updateMessage, removeMessage, messages } = useChatStore.getState();

    if (!user) return;

    const replyToMessage =
      data.replyTo && conversationId
        ? (messages[conversationId] || []).find(
            (message) => String(message.id) === String(data.replyTo),
          )
        : null;

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: user.id,
      senderName: user.fullName,
      senderAvatar: user.avatarUrl,
      type: data.type,
      content: data.content,
      attachments: data.attachments,
      metadata: data.metadata,
      replyTo: data.replyTo
        ? {
            id: String(data.replyTo),
            content: getReplyPreviewText(replyToMessage),
            senderName: replyToMessage?.senderName || "Nguoi dung",
          }
        : null,
      reactions: [],
      readBy: [],
      isDeleted: false,
      isEdited: false,
      createdAt: new Date().toISOString(),
    };
    addMessage(conversationId, tempMessage);

    const socket = socketService.getSocket();
    const canUseSocket = Boolean(socket?.connected);
    const payload = {
      conversationId,
      type: data.type,
      content: typeof data.content === "string" ? toServerContent(data.type, data.content) : data.content,
      attachments: data.attachments,
      replyTo: data.replyTo,
      metadata: data.metadata,
      clientTempId: tempMessage.id,
    };

    if (canUseSocket) {
      let savedMessage: Message | undefined;
      await new Promise<void>((resolve, reject) => {
        socketService.emit(
          "chat:send",
          payload,
          (ack: { success: boolean; message?: any; error?: string }) => {
            if (ack?.success && ack.message) {
              const saved = normalizeMessage(ack.message);
              updateMessage(conversationId, tempMessage.id, saved);
              savedMessage = saved;
              resolve();
            } else {
              console.error("chat:send ack failed:", ack);
              removeMessage(conversationId, tempMessage.id);
              reject(new Error(ack?.error || "Failed to send message"));
            }
          },
        );
      });
      return savedMessage;
    }

    try {
      const response = await apiClient.post("/api/messages", {
        conversationId,
        type: data.type,
        content: typeof data.content === "string" ? toServerContent(data.type, data.content) : data.content,
        attachments: data.attachments,
        replyTo: data.replyTo,
        metadata: data.metadata,
      });
      const saved = normalizeMessage(response.data);
      updateMessage(conversationId, tempMessage.id, saved);
      return saved;
    } catch (error) {
      console.error("Failed to send message:", error);
      removeMessage(conversationId, tempMessage.id);
      throw error;
    }
  },

  sendTyping(conversationId: string) {
    socketService.emit("chat:typing", { conversationId });
  },

  async markAsRead(conversationId: string, messageId: string) {
    socketService.emit("chat:read", { conversationId, messageId });
  },

  async deleteMessage(conversationId: string, messageId: string) {
    const { updateMessage } = useChatStore.getState();

    updateMessage(conversationId, messageId, { isDeleted: true });

    try {
      socketService.emit("chat:recall", { conversationId, messageId });
    } catch (error) {
      console.error("Failed to delete message:", error);
      updateMessage(conversationId, messageId, { isDeleted: false });
    }
  },

  async addReaction(conversationId: string, messageId: string, emoji: string) {
    socketService.emit("chat:reaction", { conversationId, messageId, emoji });
  },

  async createConversation(
    participantIds: string[],
    type: "private" | "group" = "private",
    name?: string,
  ): Promise<Conversation> {
    const response = await apiClient.post<Conversation>("/api/conversations", {
      participantIds,
      type,
      name,
    });

    const conversation = response.data;
    const { addConversation } = useChatStore.getState();
    addConversation(conversation);

    return conversation;
  },

  destroy() {
    socketService.disconnect();
  },
};

export default chatService;

export async function votePollMessage(
  messageId: string,
  optionIds: string[],
): Promise<Message> {
  const response = await apiClient.post(`/api/messages/${messageId}/poll/vote`, {
    optionIds,
  });
  return normalizeMessage(response.data);
}

export async function addPollOptionMessage(
  messageId: string,
  text: string,
): Promise<Message> {
  const response = await apiClient.post(`/api/messages/${messageId}/poll/options`, {
    text,
  });
  return normalizeMessage(response.data);
}

export async function removePollOptionMessage(
  messageId: string,
  optionId: string,
): Promise<Message> {
  const response = await apiClient.delete(
    `/api/messages/${messageId}/poll/options/${optionId}`,
  );
  return normalizeMessage(response.data);
}
