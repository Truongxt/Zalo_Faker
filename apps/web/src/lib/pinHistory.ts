import type { Message } from "@/stores/chatStore";

export type PinHistoryAction = "pin" | "unpin";

export type PinHistoryEntry = {
  eventKey: string;
  conversationId: string;
  actorId: string;
  actorName: string;
  action: PinHistoryAction;
  previewText: string;
  targetMessageId: string;
  createdAt: string;
};

const STORAGE_KEY = "chat-pin-history-v1";
const MAX_HISTORY_PER_CONVERSATION = 60;

const readStore = (): Record<string, PinHistoryEntry[]> => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, PinHistoryEntry[]>;
  } catch {
    return {};
  }
};

const writeStore = (value: Record<string, PinHistoryEntry[]>) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
};

const normalizeEntries = (entries: PinHistoryEntry[]) =>
  [...entries]
    .filter((entry) => entry && typeof entry === "object" && entry.eventKey)
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    )
    .slice(-MAX_HISTORY_PER_CONVERSATION);

export const loadPinHistoryEntries = (conversationId: string) => {
  const normalizedConversationId = String(conversationId || "").trim();
  if (!normalizedConversationId) return [];

  const store = readStore();
  return normalizeEntries(store[normalizedConversationId] || []);
};

export const appendPinHistoryEntry = (entry: PinHistoryEntry) => {
  const normalizedConversationId = String(entry.conversationId || "").trim();
  if (!normalizedConversationId) return [];

  const store = readStore();
  const currentEntries = store[normalizedConversationId] || [];
  const existed = currentEntries.some(
    (currentEntry) => currentEntry.eventKey === entry.eventKey,
  );

  const nextEntries = existed
    ? normalizeEntries(currentEntries)
    : normalizeEntries([...currentEntries, entry]);

  store[normalizedConversationId] = nextEntries;
  writeStore(store);
  return nextEntries;
};

export const isPinHistoryMessage = (message: Message | null | undefined) =>
  Boolean((message as any)?.metadata?.pinHistory === true);

export const toPinHistoryMessage = (entry: PinHistoryEntry): Message =>
  ({
    id: `pin-history-${entry.eventKey}`,
    conversationId: entry.conversationId,
    senderId: entry.actorId || "system",
    type: "system",
    content: {},
    metadata: {
      pinHistory: true,
      action: entry.action,
      actorName: entry.actorName,
      previewText: entry.previewText,
    },
    reactions: [],
    readBy: [],
    isDeleted: false,
    createdAt: entry.createdAt,
  }) as Message;

export const mergeMessagesWithPinHistory = (
  messages: Message[],
  historyEntries: PinHistoryEntry[],
) => {
  const baseMessages = Array.isArray(messages) ? messages : [];
  const historyMessages = historyEntries.map(toPinHistoryMessage);

  return [...baseMessages, ...historyMessages].sort((left, right) => {
    const timeDiff =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return String(left.id).localeCompare(String(right.id));
  });
};
