import apiClient from "./apiClient";

type AskAIEnvelope = {
  success?: boolean;
  data?: {
    reply?: string;
  };
};

type AIHistoryEnvelope = {
  success?: boolean;
  data?: AIHistoryItem[];
};

type AISummaryEnvelope = {
  success?: boolean;
  data?: AISummaryResponse;
};

export interface AskAIResponse {
  answer: string;
}

export interface AIHistoryItem {
  userId: string;
  chatId: string;
  conversationId?: string | null;
  question: string;
  answer: string;
  askedAt: string;
}

export interface AISummaryResponse {
  conversationId: string;
  date: string;
  messageCount: number;
  summary: string;
}

class AIService {
  async ask(question: string, conversationId?: string): Promise<AskAIResponse> {
    const response = await apiClient.post<AskAIEnvelope>("/api/ai/chat", {
      question,
      conversationId,
    });

    return {
      answer: response.data?.data?.reply || "",
    };
  }

  async getHistory(limit = 30, conversationId?: string): Promise<AIHistoryItem[]> {
    const response = await apiClient.get<AIHistoryEnvelope>("/api/ai/history", {
      params: {
        limit,
        conversationId,
      },
    });

    return Array.isArray(response.data?.data) ? response.data.data : [];
  }

  async deleteConversationHistory(conversationId: string): Promise<number> {
    const response = await apiClient.delete<{
      success?: boolean;
      data?: { deletedCount?: number };
    }>(`/api/ai/history/${conversationId}`);

    return response.data?.data?.deletedCount || 0;
  }

  async summarizeConversation(conversationId: string): Promise<AISummaryResponse> {
    const response = await apiClient.post<AISummaryEnvelope>(
      `/api/ai/summarize/${conversationId}`,
      undefined,
      { timeout: 30000 },
    );

    return (
      response.data?.data || {
        conversationId,
        date: new Date().toISOString().slice(0, 10),
        messageCount: 0,
        summary: "Không thể tóm tắt lúc này. Vui lòng thử lại sau.",
      }
    );
  }

  async generateResponse(prompt: string): Promise<string> {
    const result = await this.ask(prompt);
    return result.answer;
  }
}

export const aiService = new AIService();