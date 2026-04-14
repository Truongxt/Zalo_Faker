import apiClient from "./apiClient";
import { Conversation } from "@/types";


class ConversationService {

    async getConversations(): Promise<Conversation[]> {
        const response = await apiClient.get<Conversation[]>("/api/conversations");
        return response.data;
    }

    async createConversation(data: Conversation): Promise<Conversation> {
        const response = await apiClient.post<Conversation>("/api/conversations", data);
        return response.data;
    }

    async getConversation(id: string): Promise<Conversation> {
        const response = await apiClient.get<Conversation>(`/api/conversations/${id}`);
        return response.data;
    }

    async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
        const response = await apiClient.put<Conversation>(`/api/conversations/${id}`, data);
        return response.data;
    }

    async deleteConversation(id: string): Promise<void> {
        const response = await apiClient.delete<void>(`/api/conversations/${id}`);
        return response.data;
    }

    async updateConversationBackground(conversationId: string, backgroundUrl: string): Promise<Conversation> {
        const response = await apiClient.put<Conversation>(`/api/conversations/${conversationId}`, {
            background: backgroundUrl
        });
        return response.data;
    }

    async togglePin(conversationId: string, userId: string, isPinned: boolean): Promise<any> {
        const response = await apiClient.patch<any>(`/api/conversations/${conversationId}/setting`, {
            userId,
            isPinned,
        });
        return response.data;
    }

    async updateParticipantSetting(conversationId: string, userId: string, data: any): Promise<any> {
        const response = await apiClient.patch<any>(`/api/conversations/${conversationId}/setting`, {
            userId,
            ...data
        });
        return response.data;
    }

}

export const conversationService = new ConversationService();