// import { socketService } from "@/lib/socket";
// import { useChatStore } from "@/stores/chatStore";
// import { useAuthStore } from "@/stores/authStore";
// import { API_URL } from "@/constants/config";
// import type { Message, Conversation } from "@/types";

// export const chatService = {
//   /** Initialize real-time socket listeners */
//   init() {
//     const socket = socketService.connect();
//     if (!socket) return;

//     socket.on("chat:message", (message: Message) => {
//       const { addMessage, updateConversation } = useChatStore.getState();
//       addMessage(message.conversationId, message);

//       updateConversation(message.conversationId, {
//         lastMessage: {
//           content: message.content || "[Media]",
//           type: message.type,
//           senderId: message.senderId,
//           senderName: message.senderName,
//           createdAt: message.createdAt,
//         },
//       });
//     });

//     socket.on(
//       "chat:typing",
//       ({
//         conversationId,
//         userId,
//       }: {
//         conversationId: string;
//         userId: string;
//       }) => {
//         const { addTypingUser, removeTypingUser } = useChatStore.getState();
//         addTypingUser(conversationId, userId);

//         setTimeout(() => {
//           removeTypingUser(conversationId, userId);
//         }, 3000);
//       }
//     );

//     socket.on(
//       "chat:read",
//       ({
//         conversationId,
//         messageId,
//       }: {
//         conversationId: string;
//         messageId: string;
//         userId: string;
//       }) => {
//         const { updateMessage } = useChatStore.getState();
//         updateMessage(conversationId, messageId, {});
//       }
//     );

//     socket.on(
//       "chat:deleted",
//       ({
//         conversationId,
//         messageId,
//       }: {
//         conversationId: string;
//         messageId: string;
//       }) => {
//         const { updateMessage } = useChatStore.getState();
//         updateMessage(conversationId, messageId, { isDeleted: true });
//       }
//     );
//   },

//   /** Load all conversations */
//   async loadConversations() {
//     const { accessToken } = useAuthStore.getState();
//     const { setConversations, setLoadingConversations } =
//       useChatStore.getState();

//     setLoadingConversations(true);

//     try {
//       const response = await fetch(`${API_URL}/api/conversations`, {
//         headers: { Authorization: `Bearer ${accessToken}` },
//       });

//       if (!response.ok) throw new Error("Không thể tải cuộc trò chuyện");

//       const conversations: Conversation[] = await response.json();
//       setConversations(conversations);
//     } catch (error) {
//       console.error("Failed to load conversations:", error);
//     } finally {
//       setLoadingConversations(false);
//     }
//   },

//   /** Load messages for a specific conversation */
//   async loadMessages(conversationId: string, before?: string) {
//     const { accessToken } = useAuthStore.getState();
//     const { setMessages, setLoadingMessages } = useChatStore.getState();

//     setLoadingMessages(true);

//     try {
//       let url = `${API_URL}/api/conversations/${conversationId}/messages?limit=30`;
//       if (before) url += `&before=${before}`;

//       const response = await fetch(url, {
//         headers: { Authorization: `Bearer ${accessToken}` },
//       });

//       if (!response.ok) throw new Error("Không thể tải tin nhắn");

//       const messages: Message[] = await response.json();
//       setMessages(conversationId, messages);
//     } catch (error) {
//       console.error("Failed to load messages:", error);
//     } finally {
//       setLoadingMessages(false);
//     }
//   },

//   /** Send a message (optimistic + socket + HTTP) */
//   async sendMessage(
//     conversationId: string,
//     data: {
//       type: Message["type"];
//       content: string;
//       replyTo?: string;
//     }
//   ) {
//     const { accessToken, user } = useAuthStore.getState();
//     const { addMessage } = useChatStore.getState();

//     if (!user) return;

//     // Optimistic local add
//     const tempMessage: Message = {
//       id: `temp-${Date.now()}`,
//       conversationId,
//       senderId: user.id,
//       senderName: user.fullName,
//       senderAvatar: user.avatarUrl,
//       type: data.type,
//       content: data.content,
//       reactions: [],
//       readBy: [],
//       isDeleted: false,
//       isEdited: false,
//       createdAt: new Date().toISOString(),
//     };
//     addMessage(conversationId, tempMessage);

//     // Socket emit for real-time
//     socketService.emit("chat:send", {
//       conversationId,
//       ...data,
//     });

//     // HTTP for persistence
//     try {
//       const response = await fetch(
//         `${API_URL}/api/conversations/${conversationId}/messages`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${accessToken}`,
//           },
//           body: JSON.stringify(data),
//         }
//       );

//       if (!response.ok) throw new Error("Không thể gửi tin nhắn");
//     } catch (error) {
//       console.error("Failed to send message:", error);
//     }
//   },

//   /** Send typing indicator */
//   sendTyping(conversationId: string) {
//     socketService.sendTyping(conversationId);
//   },

//   /** Mark a message as read */
//   async markAsRead(conversationId: string, messageId: string) {
//     const { accessToken } = useAuthStore.getState();
//     socketService.emit("chat:read", { conversationId, messageId });

//     try {
//       await fetch(
//         `${API_URL}/api/conversations/${conversationId}/messages/${messageId}/read`,
//         {
//           method: "POST",
//           headers: { Authorization: `Bearer ${accessToken}` },
//         }
//       );
//     } catch (error) {
//       console.error("Failed to mark as read:", error);
//     }
//   },

//   /** Delete a message */
//   async deleteMessage(conversationId: string, messageId: string) {
//     const { accessToken } = useAuthStore.getState();
//     const { updateMessage } = useChatStore.getState();

//     updateMessage(conversationId, messageId, { isDeleted: true });

//     try {
//       await fetch(
//         `${API_URL}/api/conversations/${conversationId}/messages/${messageId}`,
//         {
//           method: "DELETE",
//           headers: { Authorization: `Bearer ${accessToken}` },
//         }
//       );
//       socketService.emit("chat:delete", { conversationId, messageId });
//     } catch (error) {
//       console.error("Failed to delete message:", error);
//       updateMessage(conversationId, messageId, { isDeleted: false });
//     }
//   },

//   /** React to a message */
//   async addReaction(conversationId: string, messageId: string, emoji: string) {
//     socketService.emit("chat:reaction", { conversationId, messageId, emoji });
//   },

//   /** Create a new conversation */
//   async createConversation(
//     participantIds: string[],
//     type: "private" | "group" = "private",
//     name?: string
//   ): Promise<Conversation> {
//     const { accessToken } = useAuthStore.getState();

//     const response = await fetch(`${API_URL}/api/conversations`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${accessToken}`,
//       },
//       body: JSON.stringify({ participantIds, type, name }),
//     });

//     if (!response.ok) throw new Error("Không thể tạo cuộc trò chuyện");

//     const conversation: Conversation = await response.json();
//     const { addConversation } = useChatStore.getState();
//     addConversation(conversation);

//     return conversation;
//   },

//   /** Cleanup socket listeners */
//   destroy() {
//     socketService.disconnect();
//   },
// };

// export default chatService;
