const {
  askAI,
  getAIChatHistory,
  deleteAIConversationHistory,
} = require("../services/aiService");

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

const getAssistantHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { limit, conversationId } = req.query || {};

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const data = await getAIChatHistory({
      userId,
      limit,
      conversationId,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to get AI history",
    });
  }
};

const deleteAssistantConversationHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { conversationId } = req.params || {};

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const deletedCount = await deleteAIConversationHistory({
      userId,
      conversationId,
    });

    return res.status(200).json({
      success: true,
      data: {
        deletedCount,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete AI conversation history",
    });
  }
};

module.exports = {
  askAssistant,
  getAssistantHistory,
  deleteAssistantConversationHistory,
};