import storage from "@/lib/storage";
import type { Message } from "@/types";

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

const readStore = async (): Promise<Record<string, PinHistoryEntry[]>> => {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
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

const writeStore = async (value: Record<string, PinHistoryEntry[]>) => {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(value));
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

export const loadPinHistoryEntries = async (conversationId: string) => {
  const normalizedConversationId = String(conversationId || "").trim();
  if (!normalizedConversationId) return [];

  const store = await readStore();
  return normalizeEntries(store[normalizedConversationId] || []);
};

export const appendPinHistoryEntry = async (entry: PinHistoryEntry) => {
  const normalizedConversationId = String(entry.conversationId || "").trim();
  if (!normalizedConversationId) return [];

  const store = await readStore();
  const currentEntries = store[normalizedConversationId] || [];
  const existed = currentEntries.some(
    (currentEntry) => currentEntry.eventKey === entry.eventKey,
  );

  const nextEntries = existed
    ? normalizeEntries(currentEntries)
    : normalizeEntries([...currentEntries, entry]);

  store[normalizedConversationId] = nextEntries;
  await writeStore(store);
  return nextEntries;
};

export const isPinHistoryMessage = (message: Message | null | undefined) =>
  Boolean(message?.metadata?.pinHistory === true);

export const toPinHistoryMessage = (entry: PinHistoryEntry): Message => ({
  id: `pin-history-${entry.eventKey}`,
  conversationId: entry.conversationId,
  senderId: entry.actorId || "system",
  senderName: entry.actorName || "User",
  senderAvatar: null,
  content: "",
  metadata: {
    pinHistory: true,
    action: entry.action,
    actorName: entry.actorName,
    previewText: entry.previewText,
  },
  type: "system",
  attachments: [],
  reactions: [],
  replyTo: null,
  isDeleted: false,
  isEdited: false,
  readBy: [],
  createdAt: entry.createdAt,
});

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
