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
const conversationService = require("./conversationService");
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
  {
    name: "summarize_today_chats",
    description:
      "Tóm tắt tất cả trò chuyện trong ngày của user. Trả về danh sách những người đã nhắn tin hôm nay và tóm tắt nội dung từng cuộc hội thoại. Dùng khi user hỏi 'tóm tắt trò chuyện', 'hôm nay tôi nhắn gì', 'ai nhắn tin cho tôi', 'lịch sử trò chuyện hôm nay'.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "ID của user hiện tại" },
        date: {
          type: "string",
          description:
            "Ngày cần tóm tắt (yyyy-mm-dd). Mặc định là hôm nay.",
        },
      },
      required: ["userId"],
    },
    func: async ({ userId, date }) => {
      const targetDateStr =
        date && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? date
          : new Date().toISOString().slice(0, 10);
      const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

      // Lấy tất cả cuộc hội thoại mà user tham gia
      const conversations = await conversationService.getConversations(
        String(userId)
      );

      if (!conversations || !conversations.length) {
        return { date: targetDateStr, totalConversations: 0, conversations: [], message: "Không có cuộc hội thoại nào." };
      }

      // Cache tên user để tránh gọi lặp
      const userNameCache = new Map();
      const resolveUserName = async (uid) => {
        if (!uid) return "Không rõ";
        if (userNameCache.has(uid)) return userNameCache.get(uid);
        try {
          const user = await userService.getById(String(uid));
          const name = user?.userName || user?.phone || uid;
          userNameCache.set(uid, name);
          return name;
        } catch {
          userNameCache.set(uid, uid);
          return uid;
        }
      };

      const results = [];

      for (const conv of conversations) {
        const convId = conv._id;
        const allMessages =
          await messageService.getMessagesByConversationId(String(convId));

        // Lọc tin nhắn trong ngày, bỏ tin đã xóa
        const todayMsgs = (allMessages || []).filter((m) => {
          if (m?.isDeleted) return false;
          const t = new Date(m?.createdAt);
          return t >= startOfDay && t <= endOfDay;
        });

        if (!todayMsgs.length) continue;

        // Tìm tên người đối diện (hoặc tên nhóm)
        let chatPartnerName = conv.name || null;
        if (!chatPartnerName && conv.type === "private" && conv.participants) {
          const other = conv.participants.find(
            (p) => String(p.userId) !== String(userId)
          );
          if (other) {
            chatPartnerName = await resolveUserName(other.userId);
          }
        }
        if (!chatPartnerName) {
          chatPartnerName = conv.type === "group" ? "Nhóm chat" : "Cuộc trò chuyện";
        }

        // Format tin nhắn ngắn gọn
        const preview = [];
        for (const m of todayMsgs.slice(-20)) {
          const senderName = await resolveUserName(m.senderId);
          const text =
            typeof m.content === "string"
              ? m.content
              : m.content?.text || `[${m.type || "media"}]`;
          preview.push(`${senderName}: ${text}`);
        }

        results.push({
          conversationId: convId,
          name: chatPartnerName,
          type: conv.type,
          messageCount: todayMsgs.length,
          preview: preview.join("\n"),
        });
      }

      if (!results.length) {
        return {
          date: targetDateStr,
          totalConversations: 0,
          conversations: [],
          message: `Không có tin nhắn nào vào ngày ${targetDateStr}.`,
        };
      }

      return {
        date: targetDateStr,
        totalConversations: results.length,
        totalMessages: results.reduce((s, r) => s + r.messageCount, 0),
        conversations: results,
      };
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
const MAX_SUMMARY_SOURCE_MESSAGES = 120;

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

const parseDateParts = (dateStr) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

const parseTimezoneOffsetMinutes = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < -840 || parsed > 840) {
    const error = new Error("tzOffsetMinutes is invalid");
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const getDateStringWithOffset = (date, tzOffsetMinutes) => {
  return new Date(date.getTime() - tzOffsetMinutes * 60 * 1000)
    .toISOString()
    .slice(0, 10);
};

const resolveSummaryDateRange = ({ date, tzOffsetMinutes }) => {
  const offsetMinutes = parseTimezoneOffsetMinutes(tzOffsetMinutes);
  const targetDateStr = date
    ? String(date)
    : getDateStringWithOffset(new Date(), offsetMinutes);

  const parts = parseDateParts(targetDateStr);
  if (!parts) {
    const error = new Error("date must be in yyyy-mm-dd format");
    error.statusCode = 400;
    throw error;
  }

  const startUtcMs =
    Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) +
    offsetMinutes * 60 * 1000;

  return {
    targetDateStr,
    tzOffsetMinutes: offsetMinutes,
    startOfDay: new Date(startUtcMs),
    endOfDay: new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1),
  };
};

const resolveUserDisplayName = async (userId, cache) => {
  const key = String(userId || "");
  if (!key) return "Unknown";
  if (cache.has(key)) return cache.get(key);

  try {
    const user = await userService.getById(key);
    const name = user?.fullName || user?.userName || user?.phone || key;
    cache.set(key, name);
    return name;
  } catch (_error) {
    cache.set(key, key);
    return key;
  }
};

const resolveConversationDisplayName = async ({ conversation, requesterUserId, userNameCache }) => {
  if (!conversation) return "Cuộc trò chuyện";
  if (conversation.name) return conversation.name;

  if (conversation.type === "private" && Array.isArray(conversation.participants)) {
    const other = conversation.participants.find(
      (participant) => String(participant?.userId) !== String(requesterUserId)
    );
    if (other?.userId) {
      return resolveUserDisplayName(other.userId, userNameCache);
    }
  }

  return conversation.type === "group" ? "Nhóm chat" : "Cuộc trò chuyện";
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
- Khi user hỏi "tóm tắt trò chuyện", "hôm nay tôi nhắn gì", "ai nhắn tin cho tôi", "lịch sử trò chuyện" → gọi tool summarize_today_chats với userId của currentUser
- Khi trả kết quả tóm tắt, hiển thị dạng danh sách: tên người/nhóm + số tin nhắn + tóm tắt nội dung chính

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

/**
 * Tóm tắt trò chuyện trong ngày của một cuộc hội thoại
 * @param {object} params
 * @param {string} params.conversationId  - ID cuộc hội thoại cần tóm tắt
 * @param {string} params.userId          - ID người dùng đang yêu cầu (để xác thực)
 * @param {string} [params.date]          - Ngày cần tóm tắt (ISO yyyy-mm-dd), mặc định hôm nay
 * @param {number|string} [params.tzOffsetMinutes] - Múi giờ client (Date.getTimezoneOffset)
 * @returns {Promise<{conversationId: string, conversationName: string, summary: string, messageCount: number, date: string, tzOffsetMinutes: number}>}
 */
const summarizeTodayConversation = async ({ conversationId, userId, date, tzOffsetMinutes }) => {
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

  const conversation = await conversationService.getConversation(String(conversationId));
  if (!conversation) {
    const error = new Error("Conversation not found");
    error.statusCode = 404;
    throw error;
  }

  const isParticipant = Array.isArray(conversation.participants)
    && conversation.participants.some(
      (participant) => String(participant?.userId) === String(userId)
    );

  if (!isParticipant) {
    const error = new Error("User is not in this conversation");
    error.statusCode = 403;
    throw error;
  }

  const { targetDateStr, tzOffsetMinutes: resolvedOffset, startOfDay, endOfDay } =
    resolveSummaryDateRange({ date, tzOffsetMinutes });

  const userNameCache = new Map();
  const conversationName = await resolveConversationDisplayName({
    conversation,
    requesterUserId: userId,
    userNameCache,
  });

  // Lấy tất cả tin nhắn của cuộc hội thoại rồi lọc theo ngày
  const allMessages = await messageService.getMessagesByConversationId(String(conversationId));

  const todayMessages = (allMessages || [])
    .filter((m) => {
      if (m?.isDeleted) return false;
      const t = new Date(m?.createdAt);
      return t >= startOfDay && t <= endOfDay;
    });

  if (!todayMessages.length) {
    return {
      conversationId: String(conversationId),
      conversationName,
      summary: `Không có tin nhắn nào vào ngày ${targetDateStr}.`,
      messageCount: 0,
      date: targetDateStr,
      tzOffsetMinutes: resolvedOffset,
    };
  }

  // Định dạng tin nhắn thành văn bản
  const messagesForSummary = todayMessages.slice(-MAX_SUMMARY_SOURCE_MESSAGES);
  const chatLog = await Promise.all(
    messagesForSummary.map(async (m) => {
      const time = new Date(m.createdAt).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      });
      const sender = await resolveUserDisplayName(m.senderId, userNameCache);
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content?.text || `[${m.type || "media"}]`;
      return `[${time}] ${sender}: ${text}`;
    })
  );

  const prompt = [
    new SystemMessage(`Bạn là trợ lý tóm tắt hội thoại.
Nhiệm vụ: Đọc đoạn hội thoại dưới đây và tạo bản tóm tắt ngắn gọn bằng tiếng Việt.
Yêu cầu:
- Nêu được các chủ đề chính đã được thảo luận
- Liệt kê các quyết định hoặc thông tin quan trọng (nếu có)
- Độ dài tóm tắt: 3-6 câu, không quá 300 từ
- Không bịa thêm thông tin ngoài đoạn hội thoại`),
    new HumanMessage(`Tên cuộc trò chuyện: ${conversationName}
Ngày cần tóm tắt: ${targetDateStr}
Số lượng tin nhắn: ${todayMessages.length}

Đây là đoạn hội thoại:

${chatLog.join("\n")}

Hãy tóm tắt nội dung trên.`),
  ];

  const response = await model.invoke(prompt);
  const summary = extractTextFromResponse(response) || "Không thể tạo tóm tắt lúc này.";

  return {
    conversationId: String(conversationId),
    conversationName,
    summary,
    messageCount: todayMessages.length,
    date: targetDateStr,
    tzOffsetMinutes: resolvedOffset,
  };
};

module.exports = { askAI, getAIChatHistory, deleteAIConversationHistory, summarizeTodayConversation };