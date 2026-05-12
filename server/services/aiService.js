const {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} = require("@langchain/google-genai");
const fs = require("fs");
const path = require("path");
const { Document } = require("@langchain/core/documents");
const {
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

// ─── Model setup ────────────────────────────────────────────────────────────

const model = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL,
  apiKey: process.env.GEMINI_API_KEY,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  apiKey: process.env.GEMINI_API_KEY,
});

// ─── Tools Gemini có thể gọi ────────────────────────────────────────────────

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
    description: "Lấy danh sách bạn bè của user",
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

// ─── Tài liệu hướng dẫn hệ thống ───────────────────────────────────────────

const loadSystemGuideContext = () => {
  try {
    const docPath = path.resolve(__dirname, "../../docs/HUONG_DAN_CHUC_NANG_HE_THONG.md");
    const raw = fs.readFileSync(docPath, "utf8");
    const compact = raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    return compact.slice(0, 12000);
  } catch (_err) {
    return "";
  }
};

const SYSTEM_GUIDE_CONTEXT = loadSystemGuideContext();

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SOURCE_MESSAGES = 30;
const TOP_K = 4;
const MAX_TOOL_ITERATIONS = 2;

const MODEL_TIMEOUT_MS = Number(process.env.AI_MODEL_TIMEOUT_MS || 30000);
const EMBEDDING_TIMEOUT_MS = Number(process.env.AI_EMBEDDING_TIMEOUT_MS || 8000);
const TOOL_TIMEOUT_MS = Number(process.env.AI_TOOL_TIMEOUT_MS || 10000);
const USER_LOOKUP_TIMEOUT_MS = Number(process.env.AI_USER_LOOKUP_TIMEOUT_MS || 5000);
const SUMMARY_FETCH_TIMEOUT_MS = Number(process.env.AI_SUMMARY_FETCH_TIMEOUT_MS || 20000);
const SUMMARY_MODEL_TIMEOUT_MS = Number(process.env.AI_SUMMARY_MODEL_TIMEOUT_MS || MODEL_TIMEOUT_MS);
const SUMMARY_MAX_MESSAGES = Number(process.env.AI_SUMMARY_MAX_MESSAGES || 80);
const SUMMARY_MAX_LINE_CHARS = Number(process.env.AI_SUMMARY_MAX_LINE_CHARS || 240);
const SUMMARY_MAX_PROMPT_CHARS = Number(process.env.AI_SUMMARY_MAX_PROMPT_CHARS || 12000);
const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

// ─── Utilities ───────────────────────────────────────────────────────────────

const getSafeTimeout = (value, fallback) => {
  const timeout = Number(value);
  if (Number.isFinite(timeout) && timeout > 0) return timeout;
  return fallback;
};

const withTimeout = async (operation, timeoutMs, label) => {
  const safeTimeout = getSafeTimeout(timeoutMs, 30000);
  let timeoutId;

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation()),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(`${label} timed out after ${safeTimeout}ms`);
          error.statusCode = 504;
          reject(error);
        }, safeTimeout);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
};

const norm = (vector) => Math.sqrt(dot(vector, vector));

const cosineSimilarity = (a, b) => {
  const denominator = norm(a) * norm(b);
  if (!denominator) return 0;
  return dot(a, b) / denominator;
};

const formatDocs = (docs) =>
  docs
    .map((doc) => doc.pageContent.replace(/sender:/g, "User "))
    .join("\n");

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

  const vectors = await withTimeout(
    () => embeddings.embedDocuments(sourceDocs.map((d) => d.pageContent)),
    EMBEDDING_TIMEOUT_MS,
    "AI document embedding"
  );
  const index = sourceDocs.map((doc, i) => ({ doc, vector: vectors[i] }));
  const queryVector = await withTimeout(
    () => embeddings.embedQuery(question),
    EMBEDDING_TIMEOUT_MS,
    "AI query embedding"
  );

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

const parseToolArgs = (args) => {
  if (!args) return {};
  if (typeof args === "object") return args;
  if (typeof args !== "string") return {};
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
};

const getToolCallsFromResponse = (response) => {
  const directToolCalls = Array.isArray(response?.tool_calls) ? response.tool_calls : [];
  const additionalToolCalls = Array.isArray(response?.additional_kwargs?.tool_calls)
    ? response.additional_kwargs.tool_calls
    : [];

  return [...directToolCalls, ...additionalToolCalls]
    .map((call, index) => {
      const name = call?.name || call?.function?.name;
      if (!name) return null;
      const callId = call?.id || `${name}-${Date.now()}-${index}`;
      const rawArgs = call?.args ?? call?.arguments ?? call?.function?.arguments;
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
  } catch (_err) {
    return String(value ?? "");
  }
};

const extractTextFromResponse = (response) => {
  const content = response?.content;

  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (typeof response?.text === "string") return response.text.trim();

  return "";
};

const isTimeoutError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.statusCode === 504 || message.includes("timed out");
};

const buildFallbackAnswer = (question) => {
  const normalized = String(question || "").trim();
  if (!normalized) {
    return "Mình chưa thể xử lý yêu cầu lúc này. Bạn thử lại sau nhé.";
  }

  return "Mình đang gặp trục trặc khi gọi AI. Bạn thử lại sau ít phút nhé.";
};

const normalizeQuestionText = (question) =>
  String(question || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const hasAnyPhrase = (text, phrases) => phrases.some((phrase) => text.includes(phrase));

const getQuickIntentAnswer = async ({ question, userId }) => {
  const normalizedQuestion = normalizeQuestionText(question);

  if (!normalizedQuestion) return null;

  if (hasAnyPhrase(normalizedQuestion, ["xoa tai khoan", "xoa tk", "delete account"])) {
    return [
      "Bạn có thể xóa tài khoản trong phần Cài đặt > Xóa tài khoản.",
      "Hệ thống hiện dùng luồng xóa vĩnh viễn bằng trạng thái `deleted`, nên thao tác này không thể khôi phục.",
    ].join(" ");
  }

  if (hasAnyPhrase(normalizedQuestion, ["may la ai", "ban la ai", "ai la ban"])) {
    return "Mình là AI trợ lý trong ứng dụng chat này.";
  }

  if (hasAnyPhrase(normalizedQuestion, ["bao nhieu ban be", "so ban be", "dem ban be"])) {
    if (!userId) return "Mình chưa xác định được tài khoản của bạn để đếm bạn bè.";
    const friends = await withTimeout(
      () => friendService.getFriends(String(userId)),
      TOOL_TIMEOUT_MS,
      "Friend count lookup"
    );
    const count = Array.isArray(friends) ? friends.length : 0;
    return `Bạn hiện có ${count} bạn bè.`;
  }

  return null;
};

const buildFeatureGuideAnswer = () => [
  "Một số tính năng chính của ứng dụng:",
  "- Chat 1-1 và nhóm",
  "- Gửi ảnh, video, file, voice",
  "- Gọi thoại và video",
  "- Trợ lý AI để hỏi nhanh thông tin",
].join("\n");

const truncateText = (value, maxLength) => {
  const text = String(value || "");
  if (!Number.isFinite(maxLength) || maxLength <= 0) return text;
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 3)}...`;
};

const getDateInVietnam = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: VN_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch (_err) {
    const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
  }
};

const getTimeInVietnam = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "00:00";

  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: VN_TIME_ZONE,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (_err) {
    const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const hour = String(shifted.getUTCHours()).padStart(2, "0");
    const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
  }
};

const extractMessageText = (message) => {
  if (typeof message?.content === "string") return message.content.trim();
  if (message?.content && typeof message.content === "object") {
    return String(
      message.content.text || message.content.message || message.content.content || ""
    ).trim();
  }
  return "";
};

const getMessageTypeLabel = (type) => {
  if (type === "image") return "[Hình ảnh]";
  if (type === "video") return "[Video]";
  if (type === "file") return "[Tệp đính kèm]";
  if (type === "voice") return "[Tin nhắn thoại]";
  if (type === "sticker") return "[Nhãn dán]";
  if (type === "call") return "[Cuộc gọi]";
  return "";
};

const filterMessagesByDateVN = (messages, dateStr) =>
  (messages || [])
    .filter((m) => !m?.isDeleted)
    .filter((m) => Boolean(m?.createdAt))
    .filter((m) => getDateInVietnam(m.createdAt) === dateStr);

const buildHeuristicSummary = (todayMessages) => {
  const firstMessages = todayMessages.slice(0, 3).map((message) => {
    const text = extractMessageText(message);
    if (text) return truncateText(text, SUMMARY_MAX_LINE_CHARS);
    return getMessageTypeLabel(message?.type);
  }).filter(Boolean);

  if (!firstMessages.length) {
    return "Trong ngày hôm nay có trao đổi trong cuộc trò chuyện này, nhưng chưa thể tạo bản tóm tắt chi tiết.";
  }

  const preview = firstMessages.join(" | ");
  return `Trong ngày hôm nay, cuộc trò chuyện xoay quanh: ${preview}${todayMessages.length > 3 ? "..." : ""}`;
};

// ─── Agent chính ─────────────────────────────────────────────────────────────

const runAgent = async ({ question, userId, conversationId }) => {
  let ragContext = "";
  let currentUser = null;

  const quickAnswer = await getQuickIntentAnswer({ question, userId });
  if (quickAnswer) {
    return quickAnswer;
  }

  const normalizedQuestion = normalizeQuestionText(question);

  if (hasAnyPhrase(normalizedQuestion, ["huong dan nhanh cac tinh nang chinh", "tinh nang chinh", "gioi thieu tinh nang"])) {
    return buildFeatureGuideAnswer();
  }

  // Lấy thông tin user hiện tại
  if (userId) {
    try {
      currentUser = sanitizeCurrentUser(
        await withTimeout(
          () => userService.getById(String(userId)),
          USER_LOOKUP_TIMEOUT_MS,
          "Current user lookup"
        )
      );
    } catch (_err) {
      currentUser = null;
    }
  }

  // Lấy context hội thoại nếu có (RAG)
  if (conversationId) {
    try {
      const messages = await withTimeout(
        () => messageService.getMessagesByConversationId(String(conversationId)),
        TOOL_TIMEOUT_MS,
        "Conversation context lookup"
      );
      const docs = buildDocsFromMessages(messages, String(conversationId));
      if (docs.length) {
        const relatedDocs = await withTimeout(
          () => retrieveRelevantDocs(question, docs),
          EMBEDDING_TIMEOUT_MS * 2,
          "RAG retrieval"
        );
        ragContext = formatDocs(relatedDocs);
      }
    } catch (_err) {
      ragContext = "";
    }
  }

  // Xây dựng system prompt
  const systemParts = [
    "Bạn là AI trợ lý trong ứng dụng chat (tương tự Zalo).",
    "Hãy trả lời tự nhiên, thân thiện, ngắn gọn, ưu tiên tiếng Việt.",
    "Không được tự bịa thông tin. Nếu cần dữ liệu thực của user thì gọi tool.",
    "",
    currentUser
      ? `Thông tin người dùng hiện tại (đã xác thực):\n${JSON.stringify(currentUser)}`
      : "Chưa xác định được người dùng.",
  ];

  if (ragContext) {
    systemParts.push("", `Nội dung hội thoại liên quan:\n${ragContext}`);
  }

  if (SYSTEM_GUIDE_CONTEXT) {
    systemParts.push("", `Tài liệu hướng dẫn ứng dụng:\n${SYSTEM_GUIDE_CONTEXT.slice(0, 6000)}`);
  }

  const systemPrompt = systemParts.join("\n").trim();

  const messagesForModel = [
    new SystemMessage(systemPrompt),
    new HumanMessage(question),
  ];

  // Vòng lặp tool-calling
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await withTimeout(
      () => modelWithTools.invoke(messagesForModel),
      MODEL_TIMEOUT_MS,
      "AI model response"
    );
    messagesForModel.push(response);

    const toolCalls = getToolCallsFromResponse(response);

    // Không có tool call → trả về câu trả lời ngay
    if (!toolCalls.length) {
      const answer = extractTextFromResponse(response);
      if (answer) return answer;
      break;
    }

    // Thực thi từng tool
    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);

      if (!tool) {
        messagesForModel.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: `Tool "${toolCall.name}" không tồn tại.`,
          })
        );
        continue;
      }

      try {
        const toolResult = await withTimeout(
          () => tool.func(toolCall.args || {}),
          TOOL_TIMEOUT_MS,
          `Tool ${toolCall.name}`
        );
        messagesForModel.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: stringifyToolResult(toolResult),
          })
        );
      } catch (toolErr) {
        messagesForModel.push(
          new ToolMessage({
            tool_call_id: toolCall.id,
            content: `Tool "${toolCall.name}" thất bại: ${toolErr?.message || "Lỗi không xác định"}`,
          })
        );
      }
    }
  }

  // Tổng hợp câu trả lời cuối sau khi tool đã chạy
  const finalResponse = await withTimeout(
    () => model.invoke(messagesForModel),
    MODEL_TIMEOUT_MS,
    "AI final response"
  );
  const finalAnswer = extractTextFromResponse(finalResponse);

  return finalAnswer || "Mình chưa thể xử lý yêu cầu lúc này. Bạn thử lại sau nhé.";
};

// ─── Public API ──────────────────────────────────────────────────────────────

const askAI = async ({ question, conversationId, userId }) => {
  try {
    if (typeof question !== "string" || !question.trim()) {
      const error = new Error("Question is required");
      error.statusCode = 400;
      throw error;
    }

    const reply = await runAgent({ question, userId, conversationId });

    // Lưu lịch sử chat
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
        console.warn("Failed to save AI chat history:", historyError?.message || historyError);
      }
    }

    return reply;
  } catch (err) {
    console.error("AI SERVICE ERROR:", err);
    if (isTimeoutError(err)) {
      return buildFallbackAnswer(question);
    }

    const error = new Error(err?.message || "AI processing failed");
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

// ─── Tóm tắt hội thoại trong ngày ───────────────────────────────────────────

const summarizeConversationToday = async ({ conversationId, userId }) => {
  if (!conversationId) {
    const error = new Error("conversationId is required");
    error.statusCode = 400;
    throw error;
  }
  const todayDateStr = getDateInVietnam(new Date()) || new Date().toISOString().slice(0, 10);

  try {
    // Lấy toàn bộ tin nhắn của cuộc trò chuyện
    const allMessages = await withTimeout(
      () => messageService.getMessagesByConversationId(String(conversationId)),
      SUMMARY_FETCH_TIMEOUT_MS,
      "Fetch messages for summary"
    );

    const todayMessages = filterMessagesByDateVN(allMessages, todayDateStr);

    if (todayMessages.length === 0) {
      return {
        conversationId,
        date: todayDateStr,
        messageCount: 0,
        summary: "Hôm nay chưa có tin nhắn nào trong cuộc trò chuyện này.",
      };
    }

    if (todayMessages.length <= 2) {
      return {
        conversationId,
        date: todayDateStr,
        messageCount: todayMessages.length,
        summary: buildHeuristicSummary(todayMessages),
      };
    }

    // Định dạng tin nhắn để gửi cho Gemini
    const formatMsg = (m) => {
      const time = getTimeInVietnam(m.createdAt);
      const text = truncateText(extractMessageText(m), SUMMARY_MAX_LINE_CHARS);
      const typeLabel = getMessageTypeLabel(m.type);
      const content = text || typeLabel || "[Nội dung không hiển thị]";
      return `[${time}] ${m.senderId || "unknown"}: ${content}`;
    };

    const summarySourceMessages = todayMessages.slice(-Math.max(1, SUMMARY_MAX_MESSAGES));
    const summaryLines = summarySourceMessages.map(formatMsg);
    const chatLog = truncateText(summaryLines.join("\n"), SUMMARY_MAX_PROMPT_CHARS);

    // Lấy thông tin user gọi API (để hỗ trợ context nếu cần)
    let currentUser = null;
    if (userId) {
      try {
        currentUser = sanitizeCurrentUser(
          await withTimeout(() => userService.getById(String(userId)), USER_LOOKUP_TIMEOUT_MS, "User lookup")
        );
      } catch (_) { }
    }

    const systemPrompt = [
      "Bạn là AI trợ lý trong ứng dụng chat (tương tự Zalo).",
      "Nhiệm vụ của bạn là tóm tắt nội dung cuộc trò chuyện được cung cấp.",
      "Hãy viết tóm tắt bằng tiếng Việt, ngắn gọn, rõ ràng.",
      "Tóm tắt nên nêu: chủ đề chính, các điểm nổi bật, kết luận hoặc hành động cần làm (nếu có).",
      currentUser ? `Người yêu cầu tóm tắt: ${currentUser.userName || currentUser.userId}` : "",
    ].filter(Boolean).join("\n");

    const userPrompt = [
      `Đây là nội dung cuộc trò chuyện ngày ${todayDateStr} (${todayMessages.length} tin nhắn):`,
      "",
      chatLog,
      "",
      "Hãy tóm tắt cuộc trò chuyện trên.",
    ].join("\n");

    let response;
    try {
      response = await withTimeout(
        () => model.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]),
        SUMMARY_MODEL_TIMEOUT_MS,
        "AI summarize"
      );
    } catch (modelErr) {
      if (!isTimeoutError(modelErr)) {
        throw modelErr;
      }

      const compactLines = summaryLines.slice(-Math.min(summaryLines.length, 30));
      const compactPrompt = [
        `Đây là phần rút gọn cuộc trò chuyện ngày ${todayDateStr}:`,
        "",
        truncateText(compactLines.join("\n"), Math.min(SUMMARY_MAX_PROMPT_CHARS, 5000)),
        "",
        "Hãy tóm tắt ngắn gọn theo ý chính.",
      ].join("\n");

      response = await withTimeout(
        () => model.invoke([new SystemMessage(systemPrompt), new HumanMessage(compactPrompt)]),
        Math.max(12000, Math.floor(SUMMARY_MODEL_TIMEOUT_MS * 0.7)),
        "AI summarize retry"
      );
    }

    const summary = extractTextFromResponse(response);

    return {
      conversationId,
      date: todayDateStr,
      messageCount: todayMessages.length,
      summary: summary || buildHeuristicSummary(todayMessages),
    };
  } catch (err) {
    console.error("AI SUMMARY FALLBACK:", err);

    let allMessages = [];
    try {
      allMessages = await withTimeout(
        () => messageService.getMessagesByConversationId(String(conversationId)),
        SUMMARY_FETCH_TIMEOUT_MS,
        "Fetch messages for summary fallback"
      );
    } catch (_) { }

    const todayMessages = filterMessagesByDateVN(allMessages, todayDateStr);

    return {
      conversationId,
      date: todayDateStr,
      messageCount: todayMessages.length,
      summary: buildHeuristicSummary(todayMessages),
    };
  }
};



module.exports = { askAI, getAIChatHistory, deleteAIConversationHistory, summarizeConversationToday };
