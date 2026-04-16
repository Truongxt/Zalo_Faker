import apiClient from "./apiClient";
import { Conversation } from "@/types";

export interface DailyConversationSummary {
    conversationId: string;
    conversationName: string;
    summary: string;
    messageCount: number;
    date: string;
    tzOffsetMinutes: number;
}


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

    async pinMessage(conversationId: string, messageId: string): Promise<any> {
        const response = await apiClient.put<any>(`/api/conversations/${conversationId}/pin-message`, {
            messageId,
        });
        return response.data;
    }

    async unpinMessage(conversationId: string): Promise<any> {
        const response = await apiClient.delete<any>(`/api/conversations/${conversationId}/pin-message`);
        return response.data;
    }

    async getDailySummary(
        conversationId: string,
        options: { date?: string; tzOffsetMinutes?: number } = {},
    ): Promise<DailyConversationSummary> {
        const query: string[] = [];
        if (typeof options.date === "string" && options.date.trim()) {
            query.push(`date=${encodeURIComponent(options.date.trim())}`);
        }
        if (Number.isFinite(options.tzOffsetMinutes)) {
            query.push(`tzOffsetMinutes=${Math.trunc(Number(options.tzOffsetMinutes))}`);
        }

        const endpoint = `/api/conversations/${conversationId}/daily-summary${query.length ? `?${query.join("&")}` : ""}`;
        const response = await apiClient.get<any>(endpoint);
        const payload = response.data || {};
        const data = payload?.data || payload;

        return {
            conversationId: String(data?.conversationId || conversationId),
            conversationName: String(data?.conversationName || ""),
            summary: String(data?.summary || ""),
            messageCount: Number(data?.messageCount || 0),
            date: String(data?.date || ""),
            tzOffsetMinutes: Number(data?.tzOffsetMinutes || options.tzOffsetMinutes || 0),
        };
    }

}

export const conversationService = new ConversationService();