const aiService = require("../services/aiService");

const askAssistant = async (req, res) => {
  try {
    const { question, conversationId } = req.body || {};
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({ message: "question is required" });
    }

    const result = await aiService.askAssistant({
      question,
      userId: String(userId),
      conversationId: conversationId ? String(conversationId) : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to generate AI response",
    });
  }
};

module.exports = {
  askAssistant,
};
