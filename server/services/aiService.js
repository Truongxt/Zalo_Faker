const {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} = require("@langchain/google-genai");
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
    `),
    new HumanMessage(question),
  ];

  for (let i = 0; i < 3; i += 1) {
    const res = await modelWithTools.invoke(messagesForModel);

    messagesForModel.push(res);

    if (res.tool_calls && res.tool_calls.length > 0) {
      for (const call of res.tool_calls) {
        const tool = tools.find((item) => item.name === call.name);

        if (!tool) {
          continue;
        }

        let args = {};
        try {
          args = typeof call.args === "string" ? JSON.parse(call.args || "{}") : (call.args || {});
        } catch (error) {
          args = {};
        }

        if (!args.userId) args.userId = userId;

        const result = await tool.func(args);

        messagesForModel.push(
          new ToolMessage({
            content: JSON.stringify(result),
            tool_call_id: call.id || call.name,
            name: call.name,
          })
        );
      }

      continue;
    }

    return typeof res.content === "string"
      ? res.content
      : Array.isArray(res.content)
        ? res.content
            .map((block) => (typeof block === "string" ? block : block?.text || ""))
            .join("\n")
        : String(res.content || "");
  }

  return "Không thể xử lý yêu cầu.";
};

const askAI = async ({ question, conversationId, userId }) => {
  try {
    return await runAgent({ question, userId, conversationId });

  } catch (err) {
    console.error("AI SERVICE ERROR:", err);

    const error = new Error(
      err?.message || "AI processing failed"
    );
    error.statusCode = err?.status || err?.statusCode || 500;
    throw error;
  }
};

module.exports = { askAI };