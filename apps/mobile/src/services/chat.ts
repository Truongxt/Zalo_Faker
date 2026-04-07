import { socketService } from "@/lib/socket";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { API_URL } from "@/constants/config";
import type { Message, Conversation } from "@/types";

let isRealtimeInitialized = false;

const normalizeMessage = (msg: any): Message => ({
  ...msg,
  id: msg?.id || msg?._id || `temp-${Date.now()}`,
  content:
    typeof msg?.content === "string"
      ? msg.content
      : msg?.content?.text || msg?.content?.mediaUrl || "",
  reactions: Array.isArray(msg?.reactions) ? msg.reactions : [],
  readBy: Array.isArray(msg?.readBy) ? msg.readBy : [],
  isDeleted: Boolean(msg?.isDeleted),
  isEdited: Boolean(msg?.isEdited),
  senderName: msg?.senderName || "",
  senderAvatar: msg?.senderAvatar || null,
});

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
    const { accessToken } = useAuthStore.getState();
    const { setConversations, setLoadingConversations } = useChatStore.getState();

    setLoadingConversations(true);

    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error("Khong the tai cuoc tro chuyen");

      const conversations: Conversation[] = await response.json();
      setConversations(conversations);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoadingConversations(false);
    }
  },

  async loadMessages(conversationId: string, before?: string) {
    const { accessToken } = useAuthStore.getState();
    const { setMessages, setLoadingMessages } = useChatStore.getState();

    setLoadingMessages(true);

    try {
      let url = `${API_URL}/api/messages/conversation/${conversationId}`;
      if (before) url += `?before=${encodeURIComponent(before)}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error("Khong the tai tin nhan");

      const messages: Message[] = (await response.json()).map(normalizeMessage);
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
      const response = await fetch(`${API_URL}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conversationId,
          type: data.type,
          content: toServerContent(data.type, data.content),
          replyTo: data.replyTo,
        }),
      });
      if (!response.ok) throw new Error("Khong the gui tin nhan");
      const saved = normalizeMessage(await response.json());
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
    const { accessToken } = useAuthStore.getState();

    const response = await fetch(`${API_URL}/api/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ participantIds, type, name }),
    });

    if (!response.ok) throw new Error("Khong the tao cuoc tro chuyen");

    const conversation: Conversation = await response.json();
    const { addConversation } = useChatStore.getState();
    addConversation(conversation);

    return conversation;
  },

  destroy() {
    socketService.disconnect();
  },
};

export default chatService;
