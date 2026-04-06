import apiClient from "./apiClient";

export interface AskAIResponse {
  answer: string;
  dbSummary?: string;
  meta?: {
    model?: string;
    contextCount?: number;
    usedConversationId?: string | null;
    retrievalMode?: string;
  };
}

class AIService {
  async ask(question: string, conversationId?: string): Promise<AskAIResponse> {
    const response = await apiClient.post<AskAIResponse>("/api/ai/chat", {
      question,
      conversationId,
    });

    return response.data;
  }

  async generateResponse(prompt: string): Promise<string> {
    const result = await this.ask(prompt);
    return result.answer;
  }
}

export const aiService = new AIService();