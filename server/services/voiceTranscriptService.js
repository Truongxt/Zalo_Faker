require("dotenv").config();
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getAccessibleFileUrl } = require("./file.service");

const uniq = (values = []) => [...new Set(values.filter(Boolean))];

const TRANSCRIPT_MODEL_CANDIDATES = uniq([
  process.env.VOICE_TRANSCRIPT_MODEL,
  "models/gemini-flash-latest",
  "models/gemini-2.5-flash",
  process.env.GEMINI_MODEL,
]);

const MAX_TRANSCRIPT_RETRIES = Number(process.env.VOICE_TRANSCRIPT_RETRIES || 2);
const RETRY_BASE_DELAY_MS = Number(process.env.VOICE_TRANSCRIPT_RETRY_BASE_DELAY_MS || 1500);

const MAX_AUDIO_BYTES = Number(process.env.VOICE_TRANSCRIPT_MAX_BYTES || 15 * 1024 * 1024);
const FETCH_TIMEOUT_MS = Number(process.env.VOICE_TRANSCRIPT_FETCH_TIMEOUT_MS || 15000);
const GENERATE_TIMEOUT_MS = Number(process.env.VOICE_TRANSCRIPT_GENERATE_TIMEOUT_MS || 60000);

const EXTENSION_TO_MIME = {
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".webm": "audio/webm",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".aac": "audio/aac",
};

const PROMPT = [
  "Ban la he thong speech-to-text.",
  "Hay chuyen doan ghi am thanh van ban tieng Viet sat nghia nhat co the.",
  "Chi tra ve noi dung transcript, khong them mo dau, nhan, markdown hay giai thich.",
  "Neu audio nhieu nguon ngon ngu thi giu nguyen ngon ngu goc, khong dich.",
].join("\n");

const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const withTimeout = async (promiseFactory, timeoutMs, timeoutMessage) => {
  const controller = new AbortController();
  let timeoutHandle;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      promiseFactory(controller.signal),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const parseMimeType = (rawValue) => {
  if (!rawValue || typeof rawValue !== "string") return "";
  return rawValue.split(";")[0].trim().toLowerCase();
};

const getExistingTranscript = (message = {}) => {
  const content = message.content;
  const metadata = message.metadata;

  if (isObject(content) && typeof content.transcript === "string") {
    const trimmed = content.transcript.trim();
    if (trimmed) return trimmed;
  }

  if (isObject(metadata) && typeof metadata.transcript === "string") {
    const trimmed = metadata.transcript.trim();
    if (trimmed) return trimmed;
  }

  return "";
};

const extractVoiceUrl = (content) => {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed || null;
  }

  if (!isObject(content)) return null;

  const candidate = content.mediaUrl || content.url || content.fileUrl;
  if (typeof candidate !== "string") return null;

  const trimmed = candidate.trim();
  return trimmed || null;
};

const extractContentMimeType = (content) => {
  if (!isObject(content)) return "";

  const candidate =
    content.mimeType ||
    content.mimetype ||
    content.contentType ||
    content.fileType;

  return parseMimeType(candidate);
};

const inferMimeTypeFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname || "").toLowerCase();
    return EXTENSION_TO_MIME[ext] || "";
  } catch (_error) {
    const ext = path.extname(String(url || "")).toLowerCase();
    return EXTENSION_TO_MIME[ext] || "";
  }
};

const cleanTranscript = (value) => {
  if (typeof value !== "string") return "";

  return value
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^transcript\s*:\s*/i, "")
    .trim();
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (error) => String(error?.message || error || "").toLowerCase();

const isHardQuotaError = (error) => {
  const text = errorText(error);
  return text.includes("quota exceeded") && text.includes("limit: 0");
};

const isRetryableModelError = (error) => {
  const text = errorText(error);
  return (
    text.includes("503") ||
    text.includes("service unavailable") ||
    text.includes("high demand") ||
    text.includes("429") ||
    text.includes("too many requests") ||
    text.includes("timed out")
  );
};

const getRetryDelayMs = (error, attempt) => {
  const text = String(error?.message || error || "");
  const match = text.match(/please retry in\s*([\d.]+)s/i);
  if (match) {
    const retrySeconds = Number(match[1]);
    if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
      return Math.min(20000, Math.ceil(retrySeconds * 1000));
    }
  }

  return Math.min(20000, RETRY_BASE_DELAY_MS * Math.max(1, attempt));
};

const isEnabled = () => {
  const flag = String(process.env.VOICE_TRANSCRIPT_ENABLED || "true").trim().toLowerCase();
  return flag !== "false";
};

const addTranscriptStatus = (message, status) => {
  const nextMetadata = {
    ...(isObject(message.metadata) ? message.metadata : {}),
    transcriptStatus: status,
  };

  return {
    ...message,
    metadata: nextMetadata,
  };
};

const addTranscriptToMessage = (message, transcript) => {
  const voiceUrl = extractVoiceUrl(message.content);
  const contentObject = isObject(message.content)
    ? { ...message.content }
    : { mediaUrl: voiceUrl || "" };

  contentObject.transcript = transcript;

  return {
    ...message,
    content: contentObject,
    metadata: {
      ...(isObject(message.metadata) ? message.metadata : {}),
      transcript,
      transcriptProvider: "gemini",
      transcriptStatus: "ready",
      transcriptUpdatedAt: new Date().toISOString(),
    },
  };
};

const transcribeFromVoiceUrl = async ({ voiceUrl, mimeType }) => {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return "";

  const accessibleUrl = await getAccessibleFileUrl(voiceUrl);

  const audioResponse = await withTimeout(
    async (signal) => fetch(accessibleUrl, { method: "GET", signal }),
    FETCH_TIMEOUT_MS,
    "Voice download timed out",
  );

  if (!audioResponse.ok) {
    throw new Error(`Cannot download voice message (${audioResponse.status})`);
  }

  const arrayBuffer = await audioResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("Voice file is empty");
  }

  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error("Voice file is too large for transcription");
  }

  const responseMimeType = parseMimeType(audioResponse.headers.get("content-type"));
  const resolvedMimeType =
    mimeType || responseMimeType || inferMimeTypeFromUrl(accessibleUrl) || "audio/webm";

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  for (const modelName of TRANSCRIPT_MODEL_CANDIDATES) {
    for (let attempt = 0; attempt <= MAX_TRANSCRIPT_RETRIES; attempt += 1) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0,
            topP: 0.1,
          },
        });

        const generationResult = await withTimeout(
          async () =>
            model.generateContent([
              { text: PROMPT },
              {
                inlineData: {
                  mimeType: resolvedMimeType,
                  data: buffer.toString("base64"),
                },
              },
            ]),
          GENERATE_TIMEOUT_MS,
          "Voice transcript generation timed out",
        );

        const transcript = cleanTranscript(generationResult?.response?.text?.() || "");
        if (transcript) return transcript;
      } catch (error) {
        lastError = error;

        if (isHardQuotaError(error)) {
          break;
        }

        const canRetry =
          attempt < MAX_TRANSCRIPT_RETRIES && isRetryableModelError(error);

        if (!canRetry) {
          break;
        }

        const delayMs = getRetryDelayMs(error, attempt + 1);
        await wait(delayMs);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return "";
};

const enrichVoiceMessageWithTranscript = async (message) => {
  if (!message || String(message.type) !== "voice") {
    return message;
  }

  if (!isEnabled()) {
    return addTranscriptStatus(message, "disabled");
  }

  const existingTranscript = getExistingTranscript(message);
  if (existingTranscript) {
    return addTranscriptToMessage(message, existingTranscript);
  }

  const voiceUrl = extractVoiceUrl(message.content);
  if (!voiceUrl) {
    return addTranscriptStatus(message, "missing_audio_url");
  }

  const mimeType = extractContentMimeType(message.content);

  try {
    const transcript = await transcribeFromVoiceUrl({ voiceUrl, mimeType });

    if (!transcript) {
      return addTranscriptStatus(message, "empty");
    }

    return addTranscriptToMessage(message, transcript);
  } catch (error) {
    console.warn("Voice transcript failed:", error?.message || error);
    return addTranscriptStatus(message, "failed");
  }
};

module.exports = {
  enrichVoiceMessageWithTranscript,
};
