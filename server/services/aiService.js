const {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} = require("@langchain/google-genai");
const fs = require("fs");
const path = require("path");
const { Document } = require("@langchain/core/documents");
const {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} = require("@langchain/core/messages");
const messageService = require("./messageService");
const userService = require("./userService");
const friendService = require("./friendService");
const aiChatHistoryRepository = require("../repository/aiChatHistoryRepository");
const aiChatMessageRepository = require("../repository/aiChatMessageRepository");
require("dotenv").config();

const model = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL ,
  apiKey: process.env.GEMINI_API_KEY,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  apiKey: process.env.GEMINI_API_KEY ,
});

const tools = [
  {
    name: "get_user_info",
    description: "Lấy thông tin user theo userId",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string" },
      },
      required: ["userId"],
    },
    func: async ({ userId }) => {
      return await userService.getById(userId);
    },
  },
  {
    name: "get_user_friends",
    description: "Lấy danh sách bạn bè",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string" },
      },
      required: ["userId"],
    },
    func: async ({ userId }) => {
      return await friendService.getFriends(userId);
    },
  },
];

const modelWithTools = model.bindTools(
  tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
);

const loadSystemGuideContext = () => {
  try {
    const docPath = path.resolve(__dirname, "../../docs/HUONG_DAN_CHUC_NANG_HE_THONG.md");
    const raw = fs.readFileSync(docPath, "utf8");
    const compact = raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return compact.slice(0, 12000);
  } catch (error) {
    return "";
  }
};

const SYSTEM_GUIDE_CONTEXT = loadSystemGuideContext();

const FALLBACK_DOCS = [
  "Bạn là trợ lý cho ứng dụng chat realtime. Hỗ trợ trả lời về nhắn tin, nhóm, bạn bè, media và tài khoản.",
  "Nếu câu hỏi thiếu ngữ cảnh hội thoại, hãy hỏi lại 1-2 câu ngắn gọn để người dùng bổ sung.",
  "Trả lời ngắn gọn, rõ ràng, ưu tiên tiếng Việt tự nhiên.",
].map(
  (pageContent, index) =>
    new Document({
      pageContent,
      metadata: { source: "fallback", index },
    })
);

const MAX_SOURCE_MESSAGES = 60;
const TOP_K = 8;

const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
};

const norm = (vector) => Math.sqrt(dot(vector, vector));

const cosineSimilarity = (a, b) => {
  const denominator = norm(a) * norm(b);
  if (!denominator) return 0;
  return dot(a, b) / denominator;
};

const formatDocs = (docs) => {
  return docs
    .map((doc) => {
      const { pageContent } = doc;
      return pageContent.replace(/sender:/g, "User ");
    })
    .join("\n");
};

const buildDocsFromMessages = (messages, conversationId) => {
  const usable = (messages || [])
    .filter((m) => !m?.isDeleted)
    .filter((m) => typeof m?.content === "string" && m.content.trim())
    .slice(-MAX_SOURCE_MESSAGES);

  return usable.map(
    (m) =>
      new Document({
        pageContent: `sender:${m.senderId || "unknown"} | type:${m.type || "text"} | content:${m.content}`,
        metadata: {
          source: "conversation",
          conversationId,
          messageId: m._id,
          createdAt: m.createdAt,
        },
      })
  );
};

const retrieveRelevantDocs = async (question, sourceDocs, topK = TOP_K) => {
  if (!sourceDocs.length) return [];

  const vectors = await embeddings.embedDocuments(sourceDocs.map((d) => d.pageContent));
  const index = sourceDocs.map((doc, i) => ({ doc, vector: vectors[i] }));
  const queryVector = await embeddings.embedQuery(question);

  return index
    .map((item) => ({
      ...item,
      score: cosineSimilarity(item.vector, queryVector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.doc);
};

const sanitizeCurrentUser = (user) => {
  if (!user) return null;

  return {
    userId: user.userId || null,
    userName: user.userName || null,
    email: user.email || null,
    phone: user.phone || null,
    status: user.status || null,
  };
};

const isAskMyName = (question = "") => {
  const normalized = String(question).toLowerCase();
  return /tôi tên gì|toi ten gi|tên tôi là gì|ten toi la gi|tôi tên là gì|toi ten la gi/.test(normalized);
};

const MAX_TOOL_ITERATIONS = 3;

const parseToolArgs = (args) => {
  if (!args) return {};
  if (typeof args === "object") return args;
  if (typeof args !== "string") return {};

  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const getToolCallsFromResponse = (response) => {
  const directToolCalls = Array.isArray(response?.tool_calls)
    ? response.tool_calls
    : [];

  const additionalToolCalls = Array.isArray(response?.additional_kwargs?.tool_calls)
    ? response.additional_kwargs.tool_calls
    : [];

  const merged = [...directToolCalls, ...additionalToolCalls];

  return merged
    .map((call, index) => {
      const name = call?.name || call?.function?.name;
      if (!name) return null;

      const callId =
        call?.id ||
        `${name}-${Date.now()}-${index}`;

      const rawArgs =
        call?.args ??
        call?.arguments ??
        call?.function?.arguments;

      return {
        id: String(callId),
        name: String(name),
        args: parseToolArgs(rawArgs),
      };
    })
    .filter(Boolean);
};

const stringifyToolResult = (value) => {
  try {
    return JSON.stringify(value ?? null);
  } catch (_error) {
    return String(value ?? "");
  }
};

const extractTextFromResponse = (response) => {
  const content = response?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const parts = content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        return "";
      })
      .filter(Boolean);

    return parts.join("\n").trim();
  }

  if (typeof response?.text === "string") {
    return response.text.trim();
  }

  return "";
};

// 👉 hàm chính
const runAgent = async ({ question, userId, conversationId }) => {
  let ragContext = "";
  let currentUser = null;

  if (userId) {
    try {
      currentUser = sanitizeCurrentUser(await userService.getById(String(userId)));
    } catch (error) {
      currentUser = null;
    }
  }

  if (currentUser?.userName && isAskMyName(question)) {
    return `Bạn tên là ${currentUser.userName}.`;
  }

  if (conversationId) {
    const messages = await messageService.getMessagesByConversationId(
      String(conversationId)
    );
    const docs = buildDocsFromMessages(messages, String(conversationId));
    const relatedDocs = await retrieveRelevantDocs(question, docs);
    ragContext = formatDocs(relatedDocs);
  }

  const messagesForModel = [
    new SystemMessage(`
Bạn là AI chat assistant.

QUY TẮC:
- Nếu cần dữ liệu user -> gọi tool
- Nếu liên quan hội thoại -> dùng context
- Không được tự bịa dữ liệu
- Khi đã có userId/currentUser thì không hỏi lại userId
- Trả lời ngắn gọn

Thông tin user hiện tại (đã xác thực):
${JSON.stringify(currentUser)}

Context hội thoại:
${ragContext}

Tài liệu hướng dẫn hệ thống (dùng để trả lời tính năng/cách dùng cho người dùng):
${SYSTEM_GUIDE_CONTEXT || "(không có tài liệu hướng dẫn)"}
    `),
    new HumanMessage(question),
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await modelWithTools.invoke(messagesForModel);
    messagesForModel.push(response);

    const toolCalls = getToolCallsFromResponse(response);
    if (!toolCalls.length) {
      const answer = extractTextFromResponse(response);
      if (answer) return answer;
      break;
    }

    for (const toolCall of toolCalls) {
      const tool = tools.find((item) => item.name === toolCall.name);

      if (!tool) {
        messagesForModel.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: `Tool ${toolCall.name} is not available`,
          })
        );
        continue;
      }

      try {
        const toolResult = await tool.func(toolCall.args || {});
        messagesForModel.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: stringifyToolResult(toolResult),
          })
        );
      } catch (error) {
        messagesForModel.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: `Tool ${toolCall.name} failed: ${error?.message || "Unknown error"}`,
          })
        );
      }
    }
  }

  const fallbackResponse = await model.invoke(messagesForModel);
  const fallbackAnswer = extractTextFromResponse(fallbackResponse);

  return fallbackAnswer || "Mình chưa thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.";
};

const askAI = async ({ question, conversationId, userId }) => {
  try {
    if (typeof question !== "string" || !question.trim()) {
      const error = new Error("Question is required");
      error.statusCode = 400;
      throw error;
    }

    const reply = await runAgent({ question, userId, conversationId });

    if (userId) {
      const now = new Date().toISOString();
      const normalizedQuestion = question.trim();
      const effectiveConversationId = conversationId
        ? String(conversationId)
        : `ai-${String(userId)}-default`;

      const chatRecord = {
        userId: String(userId),
        conversationId: effectiveConversationId,
        chatId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question: normalizedQuestion,
        answer: String(reply || ""),
        askedAt: now,
      };

      try {
        await aiChatMessageRepository.create(chatRecord);
        await aiChatHistoryRepository.upsertConversation({
          userId: String(userId),
          conversationId: effectiveConversationId,
          title: normalizedQuestion,
          askedAt: now,
        });
      } catch (historyError) {
        // Do not block AI response when history storage has transient issues.
        console.warn("Failed to save AI chat history:", historyError?.message || historyError);
      }
    }

    return reply;

  } catch (err) {
    console.error("AI SERVICE ERROR:", err);

    const error = new Error(
      err?.message || "AI processing failed"
    );
    error.statusCode = err?.status || err?.statusCode || 500;
    throw error;
  }
};

const getAIChatHistory = async ({ userId, limit = 20, conversationId }) => {
  if (!userId) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  if (conversationId) {
    return aiChatMessageRepository.getByConversationId({
      conversationId: String(conversationId),
      userId: String(userId),
      limit,
    });
  }

  return aiChatMessageRepository.getByUserId({
    userId: String(userId),
    limit,
  });
};

const deleteAIConversationHistory = async ({ userId, conversationId }) => {
  if (!userId) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  if (!conversationId) {
    const error = new Error("conversationId is required");
    error.statusCode = 400;
    throw error;
  }

  const deletedMessages = await aiChatMessageRepository.deleteByConversationId({
    userId: String(userId),
    conversationId: String(conversationId),
  });

  try {
    await aiChatHistoryRepository.deleteConversationMeta({
      userId: String(userId),
      conversationId: String(conversationId),
    });
  } catch (error) {
    console.warn("Failed to delete AI thread metadata:", error?.message || error);
  }

  return deletedMessages;
};

module.exports = { askAI, getAIChatHistory, deleteAIConversationHistory };