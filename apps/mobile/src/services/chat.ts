import { socketService } from "@/lib/socket";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { API_URL } from "@/constants/config";
import type { Message, Conversation } from "@/types";
import apiClient from "./apiClient";

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

const normalizeMessage = (msg: any): Message => {
  const type = (msg?.type || "text") as Message["type"];
  const rawContent = msg?.content;
  const contentText = extractContentText(rawContent);
  const contentMediaUrl = extractContentMediaUrl(rawContent);

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
        }]
      : [];

  let normalizedContent = contentText;
  if (!normalizedContent) {
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
    senderName: msg?.senderName || "",
    senderAvatar: msg?.senderAvatar || null,
  };
};

const toServerContent = (type: Message["type"], content: string) => {
  if (type === "text") {
    return { text: content };
  }
  return { mediaUrl: content };
};

export const chatService = {
  init() {
    if (isRealtimeInitialized) return;

    const socket = socketService.connect();
    if (!socket) return;
    isRealtimeInitialized = true;

    socket.on("chat:message", (rawMessage: Message) => {
      const message = normalizeMessage(rawMessage);
      const { addMessage, updateConversation } = useChatStore.getState();
      addMessage(message.conversationId, message);

      updateConversation(message.conversationId, {
        lastMessage: {
          content: message.content || "[Media]",
          type: message.type,
          senderId: message.senderId,
          senderName: message.senderName,
          createdAt: message.createdAt,
        },
      });
    });

    socket.on("chat:typing", ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { addTypingUser, removeTypingUser } = useChatStore.getState();
      addTypingUser(conversationId, userId);

      setTimeout(() => {
        removeTypingUser(conversationId, userId);
      }, 3000);
    });

    socket.on("chat:read", ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      const { updateMessage } = useChatStore.getState();
      updateMessage(conversationId, messageId, {});
    });

    socket.on("chat:recalled", ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      const { updateMessage } = useChatStore.getState();
      updateMessage(conversationId, messageId, { isDeleted: true });
    });

    socket.on("chat:reaction", ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      const state = useChatStore.getState();
      for (const [convId, messages] of Object.entries(state.messages)) {
        const msg = (messages as Message[]).find((m) => m.id === messageId);
        if (msg) {
          state.updateMessage(convId, messageId, { reactions });
          break;
        }
      }
    });
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
      content: string;
      replyTo?: string;
    },
  ) {
    const { accessToken, user } = useAuthStore.getState();
    const { addMessage, updateMessage } = useChatStore.getState();

    if (!user) return;

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      senderId: user.id,
      senderName: user.fullName,
      senderAvatar: user.avatarUrl,
      type: data.type,
      content: data.content,
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
      content: toServerContent(data.type, data.content),
      replyTo: data.replyTo,
      clientTempId: tempMessage.id,
    };

    if (canUseSocket) {
      await new Promise<void>((resolve) => {
        socketService.emit(
          "chat:send",
          payload,
          (ack: { success: boolean; message?: any }) => {
            if (ack?.success && ack.message) {
              const saved = normalizeMessage(ack.message);
              updateMessage(conversationId, tempMessage.id, saved);
            } else {
              console.error("chat:send ack failed:", ack);
            }
            resolve();
          },
        );
      });
      return;
    }

    try {
      const response = await apiClient.post("/api/messages", {
        conversationId,
        type: data.type,
        content: toServerContent(data.type, data.content),
        replyTo: data.replyTo,
      });
      const saved = normalizeMessage(response.data);
      updateMessage(conversationId, tempMessage.id, saved);
    } catch (error) {
      console.error("Failed to send message:", error);
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
