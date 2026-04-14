class AIChatHistory {
  constructor({
    userId,
    chatId,
    conversationId,
    question,
    answer,
    askedAt,
  }) {
    this.userId = userId;
    this.chatId = chatId;
    this.conversationId = conversationId || null;
    this.question = question;
    this.answer = answer;
    this.askedAt = askedAt;
  }
}

module.exports = AIChatHistory;