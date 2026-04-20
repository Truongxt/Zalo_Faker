const crypto = require("crypto");

const POLL_MESSAGE_TYPE = "poll";
const MAX_QUESTION_LENGTH = 500;
const MAX_OPTION_LENGTH = 200;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const trimText = (value, maxLength) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, maxLength);
};

const toBoolean = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError("Invalid poll deadline");
  }
  return date.toISOString();
};

const dedupeOptionIds = (optionIds = []) => {
  const seen = new Set();
  return optionIds
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const normalizePollOptions = (options = [], userId, createdAt) => {
  if (!Array.isArray(options)) {
    throw createError("Poll options must be an array");
  }

  const normalized = options
    .map((option) =>
      typeof option === "string"
        ? { text: option }
        : option && typeof option === "object"
          ? option
          : null,
    )
    .filter(Boolean)
    .map((option) => {
      const text = trimText(option.text, MAX_OPTION_LENGTH);
      if (!text) return null;

      return {
        id:
          typeof option.id === "string" && option.id.trim()
            ? option.id.trim()
            : crypto.randomUUID(),
        text,
        createdBy:
          typeof option.createdBy === "string" && option.createdBy.trim()
            ? option.createdBy.trim()
            : String(userId),
        createdAt:
          typeof option.createdAt === "string" && option.createdAt.trim()
            ? option.createdAt.trim()
            : createdAt,
      };
    })
    .filter(Boolean);

  const uniqueByText = [];
  const seenTexts = new Set();
  normalized.forEach((option) => {
    const key = option.text.toLowerCase();
    if (seenTexts.has(key)) return;
    seenTexts.add(key);
    uniqueByText.push(option);
  });

  if (uniqueByText.length < MIN_OPTIONS) {
    throw createError("Poll must have at least 2 options");
  }

  if (uniqueByText.length > MAX_OPTIONS) {
    throw createError(`Poll can have at most ${MAX_OPTIONS} options`);
  }

  return uniqueByText;
};

const normalizePollSettings = (settings = {}) => {
  const expiresAt = normalizeDate(settings.expiresAt);
  return {
    anonymousVoters: toBoolean(settings.anonymousVoters),
    hideResultsUntilVote: toBoolean(settings.hideResultsUntilVote),
    allowMultipleChoices: toBoolean(settings.allowMultipleChoices),
    allowAddOptions: toBoolean(settings.allowAddOptions),
    expiresAt,
  };
};

const normalizePollVotes = (votes = [], optionIds = []) => {
  const validOptionIds = new Set(optionIds);
  if (!Array.isArray(votes)) return [];

  const seenUsers = new Set();
  return votes
    .map((vote) => {
      if (!vote || typeof vote !== "object") return null;
      const userId = String(vote.userId || "").trim();
      if (!userId || seenUsers.has(userId)) return null;

      const selectedOptionIds = dedupeOptionIds(vote.optionIds).filter((id) =>
        validOptionIds.has(id),
      );
      if (selectedOptionIds.length === 0) return null;

      seenUsers.add(userId);
      return {
        userId,
        optionIds: selectedOptionIds,
        votedAt:
          typeof vote.votedAt === "string" && vote.votedAt.trim()
            ? vote.votedAt.trim()
            : new Date().toISOString(),
      };
    })
    .filter(Boolean);
};

const normalizePollMessageContent = (content, userId) => {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw createError("Invalid poll content");
  }

  const createdAt = new Date().toISOString();
  const question = trimText(content.question, MAX_QUESTION_LENGTH);
  if (!question) {
    throw createError("Poll question is required");
  }

  const options = normalizePollOptions(content.options, userId, createdAt);
  const settings = normalizePollSettings(content.settings);

  if (settings.expiresAt && new Date(settings.expiresAt).getTime() <= Date.now()) {
    throw createError("Poll deadline must be in the future");
  }

  return {
    question,
    options,
    settings,
    votes: [],
    createdBy: String(userId),
    createdAt,
  };
};

const getPollPreviewText = (content) => {
  const question =
    content && typeof content === "object"
      ? trimText(content.question, MAX_QUESTION_LENGTH)
      : "";
  return question ? `[Binh chon] ${question}` : "[Binh chon]";
};

const ensurePollMessage = (message) => {
  if (!message || String(message.type) !== POLL_MESSAGE_TYPE) {
    throw createError("Message is not a poll", 400);
  }

  if (!message.content || typeof message.content !== "object" || Array.isArray(message.content)) {
    throw createError("Poll content is invalid", 400);
  }

  const optionIds = Array.isArray(message.content.options)
    ? message.content.options.map((option) => String(option?.id || "").trim())
    : [];

  return {
    ...message.content,
    question: trimText(message.content.question, MAX_QUESTION_LENGTH),
    options: normalizePollOptions(
      message.content.options || [],
      message.content.createdBy || message.senderId || "system",
      message.content.createdAt || message.createdAt || new Date().toISOString(),
    ),
    settings: normalizePollSettings(message.content.settings || {}),
    votes: normalizePollVotes(message.content.votes || [], optionIds),
    createdBy: String(
      message.content.createdBy || message.senderId || "system",
    ),
    createdAt:
      typeof message.content.createdAt === "string" && message.content.createdAt.trim()
        ? message.content.createdAt.trim()
        : message.createdAt || new Date().toISOString(),
  };
};

const isPollExpired = (poll) => {
  const expiresAt = poll?.settings?.expiresAt;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
};

const voteOnPoll = (message, { userId, optionIds }) => {
  const poll = ensurePollMessage(message);
  if (isPollExpired(poll)) {
    throw createError("Poll has expired", 400);
  }

  const normalizedOptionIds = dedupeOptionIds(optionIds);
  if (normalizedOptionIds.length === 0) {
    throw createError("Please choose at least 1 option");
  }

  if (!poll.settings.allowMultipleChoices && normalizedOptionIds.length > 1) {
    throw createError("Poll allows only 1 option");
  }

  const validOptionIds = new Set(poll.options.map((option) => option.id));
  const invalidOptionId = normalizedOptionIds.find((id) => !validOptionIds.has(id));
  if (invalidOptionId) {
    throw createError("Invalid poll option", 400);
  }

  const nextVotes = poll.votes.filter((vote) => String(vote.userId) !== String(userId));
  nextVotes.push({
    userId: String(userId),
    optionIds: normalizedOptionIds,
    votedAt: new Date().toISOString(),
  });

  return {
    ...poll,
    votes: nextVotes,
  };
};

const addOptionToPoll = (message, { userId, text }) => {
  const poll = ensurePollMessage(message);
  if (isPollExpired(poll)) {
    throw createError("Poll has expired", 400);
  }

  if (!poll.settings.allowAddOptions) {
    throw createError("Poll does not allow adding options", 400);
  }

  const nextText = trimText(text, MAX_OPTION_LENGTH);
  if (!nextText) {
    throw createError("Poll option text is required");
  }

  if (poll.options.some((option) => option.text.toLowerCase() === nextText.toLowerCase())) {
    throw createError("This option already exists", 400);
  }

  if (poll.options.length >= MAX_OPTIONS) {
    throw createError(`Poll can have at most ${MAX_OPTIONS} options`, 400);
  }

  return {
    ...poll,
    options: [
      ...poll.options,
      {
        id: crypto.randomUUID(),
        text: nextText,
        createdBy: String(userId),
        createdAt: new Date().toISOString(),
      },
    ],
  };
};

const removeOptionFromPoll = (message, { userId, optionId }) => {
  const poll = ensurePollMessage(message);
  if (isPollExpired(poll)) {
    throw createError("Poll has expired", 400);
  }

  if (String(poll.createdBy) !== String(userId)) {
    throw createError("Only the poll creator can remove options", 403);
  }

  const normalizedOptionId = String(optionId || "").trim();
  if (!normalizedOptionId) {
    throw createError("Poll option is required", 400);
  }

  const targetExists = poll.options.some(
    (option) => String(option.id) === normalizedOptionId,
  );
  if (!targetExists) {
    throw createError("Poll option not found", 404);
  }

  const nextOptions = poll.options.filter(
    (option) => String(option.id) !== normalizedOptionId,
  );
  if (nextOptions.length < MIN_OPTIONS) {
    throw createError("Poll must have at least 2 options", 400);
  }

  const nextVotes = poll.votes
    .map((vote) => ({
      ...vote,
      optionIds: vote.optionIds.filter((id) => String(id) !== normalizedOptionId),
    }))
    .filter((vote) => vote.optionIds.length > 0);

  return {
    ...poll,
    options: nextOptions,
    votes: nextVotes,
  };
};

module.exports = {
  POLL_MESSAGE_TYPE,
  normalizePollMessageContent,
  getPollPreviewText,
  ensurePollMessage,
  voteOnPoll,
  addOptionToPoll,
  removeOptionFromPoll,
};
