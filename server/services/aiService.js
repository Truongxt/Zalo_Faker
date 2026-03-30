const { GoogleGenerativeAI } = require("@google/generative-ai");
const messageService = require("./messageService");
const conversationService = require("./conversationService");
const userService = require("./userService");
const friendService = require("./friendService");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "models/gemini-2.5-flash";
const MAX_CONTEXT_MESSAGES = 20;
const MAX_MESSAGES_FOR_SUMMARY = 400;

const normalize = (value) => String(value ?? "").trim();

const tokenize = (text) =>
  normalize(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const scoreByTokenOverlap = (text, questionTokens) => {
  if (!text) return 0;
  const textTokens = new Set(tokenize(text));
  if (!textTokens.size || !questionTokens.length) return 0;

  let overlap = 0;
  for (const token of questionTokens) {
    if (textTokens.has(token)) overlap += 1;
  }

  const recencyBonus = 0.1;
  return overlap + recencyBonus;
};

const belongsToUser = (conversation, userId) => {
  const normalizedUserId = normalize(userId);

  const isCreator = normalize(conversation.createdBy) === normalizedUserId;
  const isParticipant = Array.isArray(conversation.participants)
    ? conversation.participants.some(
        (p) => normalize(p?.userId) === normalizedUserId,
      )
    : false;

  return isCreator || isParticipant;
};

const pickRelevantMessages = (messages, question) => {
  const questionTokens = tokenize(question);

  return messages
    .filter((m) => m && !m.isDeleted && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      ...m,
      _score: scoreByTokenOverlap(m.content, questionTokens),
    }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    })
    .slice(0, MAX_CONTEXT_MESSAGES);
};

const formatContext = (messages) =>
  messages
    .map((m, idx) => {
      const time = m.createdAt ? new Date(m.createdAt).toISOString() : "unknown-time";
      return `${idx + 1}. [${time}] sender:${normalize(m.senderId) || "unknown"} content:${m.content}`;
    })
    .join("\n");

const toNumericId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitizeUser = (user) => {
  if (!user) return null;

  return {
    userId: normalize(user.userId),
    userName: user.userName || null,
    email: user.email || null,
    phone: user.phone || null,
    gender: user.gender || null,
    birthday: user.birthday || null,
    status: user.status || null,
    avartarUrl: user.avartarUrl || null,
    createdAt: user.createdAt || null,
  };
};

const sanitizeConversation = (conversation) => ({
  conversationId: conversation?._id || null,
  type: conversation?.type || null,
  name: conversation?.name || null,
  createdBy: normalize(conversation?.createdBy) || null,
  createdAt: conversation?.createdAt || null,
  participantCount: Array.isArray(conversation?.participants)
    ? conversation.participants.length
    : 0,
  participants: Array.isArray(conversation?.participants)
    ? conversation.participants.map((p) => ({
        userId: normalize(p?.userId) || null,
        role: p?.role || null,
        nickname: p?.nickname || null,
        joinedAt: p?.joinedAt || null,
      }))
    : [],
  lastMessage: conversation?.lastMessage
    ? {
        senderId: normalize(conversation.lastMessage.senderId) || null,
        type: conversation.lastMessage.type || null,
        content: conversation.lastMessage.content || null,
        createdAt: conversation.lastMessage.createdAt || null,
      }
    : null,
});

const sanitizeMessage = (message) => ({
  messageId: message?._id || null,
  conversationId: message?.conversationId || null,
  senderId: normalize(message?.senderId) || null,
  type: message?.type || null,
  content: typeof message?.content === "string" ? message.content : null,
  replyTo: message?.replyTo || null,
  createdAt: message?.createdAt || null,
});

const sanitizeFriendEdge = (friend, currentUserId) => {
  const fromUserId = normalize(friend?.fromUserId);
  const toUserId = normalize(friend?.toUserId);
  const normalizedCurrentUserId = normalize(currentUserId);
  const otherUserId = fromUserId === normalizedCurrentUserId ? toUserId : fromUserId;

  return {
    fromUserId: fromUserId || null,
    toUserId: toUserId || null,
    otherUserId: otherUserId || null,
    status: friend?.status || null,
    message: friend?.message || null,
    createdAt: friend?.createdAt || null,
  };
};

const normalizeModelText = (value, fallback) => {
  const text = normalize(value);
  return text || fallback;
};

const getCandidateMessages = async ({ userId, conversationId }) => {
  if (conversationId) {
    return messageService.getMessagesByConversationId(conversationId);
  }

  const conversations = await conversationService.getConversations();
  const userConversations = conversations.filter((c) => belongsToUser(c, userId));
  const messageBuckets = await Promise.all(
    userConversations.map((c) => messageService.getMessagesByConversationId(c._id)),
  );

  return messageBuckets.flat();
};

const buildUserScopedDbData = async ({ userId, conversationId }) => {
  const [profile, candidateMessages, allConversations] = await Promise.all([
    userService.getById(String(userId)),
    getCandidateMessages({ userId, conversationId }),
    conversationService.getConversations(),
  ]);

  const relevantConversations = conversationId
    ? allConversations.filter((c) => normalize(c?._id) === normalize(conversationId))
    : allConversations.filter((c) => belongsToUser(c, userId));

  const sortedMessages = candidateMessages
    .filter((m) => m && !m.isDeleted && typeof m.content === "string" && m.content.trim())
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  const trimmedMessages =
    sortedMessages.length > MAX_MESSAGES_FOR_SUMMARY
      ? sortedMessages.slice(-MAX_MESSAGES_FOR_SUMMARY)
      : sortedMessages;

  const numericUserId = toNumericId(userId);
  let acceptedFriends = [];
  let pendingRequests = [];
  if (numericUserId !== null) {
    [acceptedFriends, pendingRequests] = await Promise.all([
      friendService.getFriends(numericUserId),
      friendService.getPendingRequests(numericUserId),
    ]);
  }

  const relatedFriendIds = new Set();
  const allFriendEdges = [...acceptedFriends, ...pendingRequests];
  for (const edge of allFriendEdges) {
    const from = normalize(edge?.fromUserId);
    const to = normalize(edge?.toUserId);
    const current = normalize(userId);
    const other = from === current ? to : from;
    if (other) relatedFriendIds.add(other);
  }

  const friendProfilesRaw = await Promise.all(
    Array.from(relatedFriendIds).map((id) => userService.getById(String(id))),
  );

  return {
    userProfile: sanitizeUser(profile),
    friends: {
      accepted: acceptedFriends.map((edge) => sanitizeFriendEdge(edge, userId)),
      pending: pendingRequests.map((edge) => sanitizeFriendEdge(edge, userId)),
      relatedProfiles: friendProfilesRaw.map((u) => sanitizeUser(u)).filter(Boolean),
    },
    conversations: relevantConversations.map((c) => sanitizeConversation(c)),
    messages: trimmedMessages.map((m) => sanitizeMessage(m)),
    stats: {
      totalRelevantConversations: relevantConversations.length,
      totalRelevantMessages: sortedMessages.length,
      messagesIncludedForSummary: trimmedMessages.length,
      messagesTrimmed: sortedMessages.length > trimmedMessages.length,
      totalAcceptedFriends: acceptedFriends.length,
      totalPendingFriendRequests: pendingRequests.length,
    },
  };
};

const askAssistant = async ({ question, userId, conversationId }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("Missing GEMINI_API_KEY in server environment");
    err.statusCode = 500;
    throw err;
  }

  const normalizedQuestion = normalize(question);
  if (!normalizedQuestion) {
    const err = new Error("Question is required");
    err.statusCode = 400;
    throw err;
  }

  const scopedDbData = await buildUserScopedDbData({ userId, conversationId });
  const candidateMessages = scopedDbData.messages.map((m) => ({
    content: m.content,
    senderId: m.senderId,
    createdAt: m.createdAt,
    isDeleted: false,
  }));
  const selectedMessages = pickRelevantMessages(candidateMessages, normalizedQuestion);
  const questionFocusedContext = formatContext(selectedMessages);
  const dbSnapshotText = JSON.stringify(scopedDbData, null, 2);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const summaryPrompt = [
    "Bạn là trợ lý AI trong ứng dụng chat.",
    "Nhiệm vụ: tổng hợp ngắn gọn dữ liệu liên quan đến người dùng từ DB.",
    "Chỉ dùng dữ liệu ngữ cảnh được cung cấp, không suy diễn.",
    "Nếu dữ liệu trống hoặc không đủ, trả lời đúng 1 câu: CHUA_DU_DU_LIEU.",
    "Kết quả tối đa 10 gạch đầu dòng, tiếng Việt.",
    "",
    "DỮ LIỆU LIÊN QUAN TỪ DB (ĐÃ LỌC THÔNG TIN BẢO MẬT):",
    dbSnapshotText,
  ].join("\n");

  const summaryResult = await model.generateContent(summaryPrompt);
  const rawSummary = summaryResult?.response?.text?.();
  const dbSummary = normalizeModelText(rawSummary, "CHUA_DU_DU_LIEU");

  const answerPrompt = [
    "Bạn là trợ lý AI trong ứng dụng chat.",
    "Nhiệm vụ: trả lời câu hỏi người dùng dựa TRỰC TIẾP trên dữ liệu DB đã tổng hợp bên dưới.",
    "Không được dùng kiến thức ngoài hoặc tự suy diễn.",
    "Nếu bản tổng hợp cho thấy thiếu dữ liệu, hãy nói rõ là chưa đủ dữ liệu để trả lời chính xác.",
    "Trả lời ngắn gọn, rõ ràng, tiếng Việt.",
    "",
    "TỔNG HỢP DỮ LIỆU DB:",
    dbSummary,
    "",
    "BẰNG CHỨNG CÂU HỎI (TRÍCH MESSAGE LIÊN QUAN):",
    questionFocusedContext || "(không có message liên quan trực tiếp)",
    "",
    `CÂU HỎI: ${normalizedQuestion}`,
  ].join("\n");

  const answerResult = await model.generateContent(answerPrompt);
  const answer =
    normalizeModelText(
      answerResult?.response?.text?.(),
      "Xin lỗi, tôi chưa thể trả lời lúc này.",
    );

  return {
    answer,
    dbSummary,
    meta: {
      model: DEFAULT_MODEL,
      contextCount: selectedMessages.length,
      usedConversationId: conversationId || null,
      retrievalMode: "db-summary-then-answer",
      dbStats: scopedDbData.stats,
    },
  };
};

module.exports = {
  askAssistant,
};
