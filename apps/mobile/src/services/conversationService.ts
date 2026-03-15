import apiClient from "./apiClient";
import { Conversation } from "@/types";


class ConversationService {

    async getConversations(): Promise<Conversation[]> {
        const response = await apiClient.get<Conversation[]>("api/conversations");
        return response.data;
    }

    async createConversation(data: Conversation): Promise<Conversation> {
        const response = await apiClient.post<Conversation>("api/conversations", data);
        return response.data;
    }

    async getConversation(id: string): Promise<Conversation> {
        const response = await apiClient.get<Conversation>(`api/conversations/${id}`);
        return response.data;
    }

    async updateConversation(id: string, data: Conversation): Promise<Conversation> {
        const response = await apiClient.put<Conversation>(`api/conversations/${id}`, data);
        return response.data;
    }

    async deleteConversation(id: string): Promise<void> {
        const response = await apiClient.delete<void>(`api/conversations/${id}`);
        return response.data;
    }

}export const conversationService = new ConversationService();