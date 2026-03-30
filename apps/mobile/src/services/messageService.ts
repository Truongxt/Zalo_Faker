import apiClient from "./apiClient";
import type { Message } from "@/types";

interface ServerMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  type: Message["type"];
  content: string;
  replyTo?: string | null;
  reactions?: Message["reactions"];
  readBy?: string[];
  isDeleted?: boolean;
  createdAt: string;
}

interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  type: Message["type"];
  content: string;
  replyTo?: string;
}

interface UpdateMessageInput {
  type?: Message["type"];
  content?: string;
  replyTo?: string | null;
  reactions?: Message["reactions"];
  readBy?: string[];
  isDeleted?: boolean;
}

const mapServerMessage = (message: ServerMessage): Message => ({
  id: message._id,
  conversationId: String(message.conversationId),
  senderId: String(message.senderId),
  senderName: "Unknown",
  senderAvatar: null,
  content: message.content ?? "",
  type: message.type,
  replyTo: message.replyTo
    ? {
        id: String(message.replyTo),
        content: "Tin nhan duoc tra loi",
        senderName: "Unknown",
      }
    : null,
  reactions: message.reactions || [],
  isDeleted: Boolean(message.isDeleted),
  isEdited: false,
  readBy: message.readBy || [],
  createdAt: message.createdAt,
});

class MessageService {
  async createMessage(data: CreateMessageInput): Promise<Message> {
    const response = await apiClient.post<ServerMessage>("/api/messages", data);
    return mapServerMessage(response.data);
  }

  async getMessage(id: string): Promise<Message> {
    const response = await apiClient.get<ServerMessage>(`/api/messages/${id}`);
    return mapServerMessage(response.data);
  }

  async getMessages(): Promise<Message[]> {
    const response = await apiClient.get<ServerMessage[]>("/api/messages");
    return response.data.map(mapServerMessage);
  }

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    const response = await apiClient.get<ServerMessage[]>(
      `/api/messages/conversation/${conversationId}`,
    );
    return response.data.map(mapServerMessage);
  }

  async updateMessage(id: string, data: UpdateMessageInput): Promise<Message> {
    const response = await apiClient.put<ServerMessage>(`/api/messages/${id}`, data);
    return mapServerMessage(response.data);
  }

  async deleteMessage(id: string): Promise<{ _id: string }> {
    const response = await apiClient.delete<{ _id: string }>(`/api/messages/${id}`);
    return response.data;
  }
}

export const messageService = new MessageService();
