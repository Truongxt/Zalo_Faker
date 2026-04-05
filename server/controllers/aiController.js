const { askAI } = require("../services/aiService");

const askAssistant = async (req, res) => {
  try {
    const { question, conversationId } = req.body || {};
    const userId = req.user?.userId;

    // ✅ check auth
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // ✅ validate input
    if (!question || typeof question !== "string") {
      return res.status(400).json({
        message: "question is required",
      });
    }

    // 🔥 gọi AI (truyền thêm context nếu có)
    const reply = await askAI({
      question,
      userId,
      conversationId,
    });

    return res.status(200).json({
      success: true,
      data: {
        reply,
      },
    });

  } catch (error) {
    console.error("AI ERROR:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to generate AI response",
    });
  }
};

module.exports = {
  askAssistant,
};