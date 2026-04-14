import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bot, MessageSquare, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import {
  askAssistant,
  deleteAssistantConversationHistory,
  getAssistantHistory,
  type AIHistoryItem,
} from "@/services/api";
import { useToast } from "@/contexts/ToastContext";

type LocalAIMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type AIThread = {
  id: string;
  title: string;
  lastAskedAt: string;
};

const createThreadId = () =>
  `ai-web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toThreadTitle = (question?: string) => {
  const normalized = String(question || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return "Hội thoại mới";
  return normalized.length > 36 ? `${normalized.slice(0, 36)}...` : normalized;
};

const buildWelcomeMessage = (): LocalAIMessage => ({
  id: "ai-welcome",
  role: "assistant",
  text: "Xin chào, mình là AI Trợ lý. Bạn có thể hỏi về dữ liệu tài khoản, tin nhắn, nhóm hoặc bất kỳ điều gì bạn cần.",
  createdAt: new Date().toISOString(),
});

const buildMessagesFromHistory = (items: AIHistoryItem[]): LocalAIMessage[] => {
  const sorted = items
    .slice()
    .sort(
      (a, b) =>
        new Date(a.askedAt || 0).getTime() - new Date(b.askedAt || 0).getTime(),
    );

  const result: LocalAIMessage[] = [buildWelcomeMessage()];

  sorted.forEach((item) => {
    result.push({
      id: `user-${item.chatId}`,
      role: "user",
      text: item.question,
      createdAt: item.askedAt,
    });
    result.push({
      id: `assistant-${item.chatId}`,
      role: "assistant",
      text: item.answer,
      createdAt: item.askedAt,
    });
  });

  return result;
};

const formatThreadTime = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STARTER_PROMPTS = [
  "Tóm tắt lịch sử trò chuyện gần đây của tôi",
  "Gợi ý cách quản lý hội thoại nhóm hiệu quả",
  "Hướng dẫn nhanh các tính năng chính của ứng dụng",
  "Viết một mẫu thông báo nhóm ngắn gọn và lịch sự",
];

export default function AIAssistant() {
  const { addToast } = useToast();
  const [threads, setThreads] = useState<AIThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [messages, setMessages] = useState<LocalAIMessage[]>([
    buildWelcomeMessage(),
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSwitchingThread, setIsSwitchingThread] = useState(false);
  const [isDeletingThread, setIsDeletingThread] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId],
  );

  const ensureFreshThread = () => {
    const newThreadId = createThreadId();
    const now = new Date().toISOString();

    setThreads([
      {
        id: newThreadId,
        title: "Hội thoại mới",
        lastAskedAt: now,
      },
    ]);
    setActiveThreadId(newThreadId);
    setMessages([buildWelcomeMessage()]);
  };

  const loadThreadMessages = async (threadId: string) => {
    setIsSwitchingThread(true);
    try {
      const history = await getAssistantHistory(80, threadId);
      setMessages(buildMessagesFromHistory(history));
      setActiveThreadId(threadId);
    } catch (error) {
      console.error("Load AI thread failed:", error);
      addToast("Không thể tải lịch sử hội thoại AI.", "error", 3000);
    } finally {
      setIsSwitchingThread(false);
    }
  };

  useEffect(() => {
    const loadInitialHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const history = await getAssistantHistory(100);

        if (!history.length) {
          ensureFreshThread();
          return;
        }

        const grouped = new Map<string, AIHistoryItem[]>();
        history.forEach((item) => {
          const key = item.conversationId || "legacy-thread";
          const bucket = grouped.get(key) || [];
          bucket.push(item);
          grouped.set(key, bucket);
        });

        const nextThreads = Array.from(grouped.entries())
          .map(([id, items]) => {
            const sorted = items
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.askedAt || 0).getTime() -
                  new Date(b.askedAt || 0).getTime(),
              );
            const firstQuestion = sorted[0]?.question;
            const lastAskedAt =
              sorted[sorted.length - 1]?.askedAt || new Date().toISOString();

            return {
              id,
              title: toThreadTitle(firstQuestion),
              lastAskedAt,
            };
          })
          .sort(
            (a, b) =>
              new Date(b.lastAskedAt || 0).getTime() -
              new Date(a.lastAskedAt || 0).getTime(),
          );

        const firstThread = nextThreads[0];
        if (!firstThread) {
          ensureFreshThread();
          return;
        }

        setThreads(nextThreads);
        setActiveThreadId(firstThread.id);
        setMessages(
          buildMessagesFromHistory(grouped.get(firstThread.id) || []),
        );
      } catch (error) {
        console.error("Load AI history failed:", error);
        addToast("Không thể tải chatbot AI.", "error", 3000);
        ensureFreshThread();
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadInitialHistory();
  }, [addToast]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  const handleCreateThread = () => {
    const newThreadId = createThreadId();
    const now = new Date().toISOString();

    setThreads((prev) => [
      {
        id: newThreadId,
        title: "Hội thoại mới",
        lastAskedAt: now,
      },
      ...prev,
    ]);
    setActiveThreadId(newThreadId);
    setMessages([buildWelcomeMessage()]);
    setInput("");
  };

  const handleDeleteThread = async (threadId: string) => {
    if (isDeletingThread) return;

    const target = threads.find((thread) => thread.id === threadId);
    const confirmed = window.confirm(
      `Xóa lịch sử hội thoại "${target?.title || "AI chat"}"?`,
    );
    if (!confirmed) return;

    setIsDeletingThread(true);
    try {
      await deleteAssistantConversationHistory(threadId);

      const remaining = threads.filter((thread) => thread.id !== threadId);
      if (!remaining.length) {
        ensureFreshThread();
        return;
      }

      setThreads(remaining);
      if (activeThreadId === threadId) {
        await loadThreadMessages(remaining[0].id);
      }
    } catch (error) {
      console.error("Delete AI history failed:", error);
      addToast("Không thể xóa hội thoại AI.", "error", 3000);
    } finally {
      setIsDeletingThread(false);
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isSending) return;

    const targetThreadId = activeThreadId || createThreadId();
    const now = new Date().toISOString();

    if (!activeThreadId) {
      setActiveThreadId(targetThreadId);
    }

    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: question,
        createdAt: now,
      },
    ]);
    setIsSending(true);

    try {
      const result = await askAssistant(question, targetThreadId);
      const answerText =
        result.reply || "Mình chưa có câu trả lời phù hợp lúc này.";

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: answerText,
          createdAt: new Date().toISOString(),
        },
      ]);

      setThreads((prev) => {
        const existing = prev.find((thread) => thread.id === targetThreadId);
        const updatedTitle =
          existing?.title && existing.title !== "Hội thoại mới"
            ? existing.title
            : toThreadTitle(question);

        const merged = existing
          ? prev.map((thread) =>
              thread.id === targetThreadId
                ? {
                    ...thread,
                    title: updatedTitle,
                    lastAskedAt: now,
                  }
                : thread,
            )
          : [
              {
                id: targetThreadId,
                title: toThreadTitle(question),
                lastAskedAt: now,
              },
              ...prev,
            ];

        return merged.sort(
          (a, b) =>
            new Date(b.lastAskedAt || 0).getTime() -
            new Date(a.lastAskedAt || 0).getTime(),
        );
      });
    } catch (error) {
      console.error("Ask assistant failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-fallback-${Date.now()}`,
          role: "assistant",
          text: "Xin lỗi, hiện tại mình chưa thể trả lời. Bạn thử lại sau nhé.",
          createdAt: new Date().toISOString(),
        },
      ]);
      addToast("Không thể gửi câu hỏi tới AI.", "error", 3000);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSend();
  };

  return (
    <div className="flex-1 flex bg-white dark:bg-dark-200">
      <aside className="hidden xl:flex w-72 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-300 flex-col">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={handleCreateThread}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Hội thoại mới
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div key={thread.id} className="group relative">
                <button
                  onClick={() => void loadThreadMessages(thread.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    isActive
                      ? "bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800"
                      : "bg-white dark:bg-dark-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-100"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate pr-8">
                    {thread.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatThreadTime(thread.lastAskedAt)}
                  </p>
                </button>
                <button
                  onClick={() => void handleDeleteThread(thread.id)}
                  className="absolute right-2 top-2 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition"
                  title="Xóa hội thoại"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                AI Trợ lý
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {activeThread?.title || "Sẵn sàng hỗ trợ bạn"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateThread}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100"
              title="Hội thoại mới"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                activeThreadId && void handleDeleteThread(activeThreadId)
              }
              disabled={!activeThreadId || isDeletingThread}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-100 disabled:opacity-40"
              title="Xóa hội thoại hiện tại"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoadingHistory || isSwitchingThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="w-10 h-10 border-4 border-primary-500/25 border-t-primary-500 rounded-full animate-spin mb-3" />
            <p>Đang tải hội thoại AI...</p>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-dark-100"
          >
            <div className="max-w-4xl mx-auto space-y-3">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        isUser
                          ? "bg-primary-500 text-white rounded-br-md"
                          : "bg-white dark:bg-dark-200 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.text}
                      </p>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-2 bg-white dark:bg-dark-200 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                    <Sparkles className="w-4 h-4 text-primary-500 animate-pulse" />
                    AI đang suy nghĩ...
                  </div>
                </div>
              )}

              {messages.length <= 1 && (
                <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="text-left px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-200 hover:bg-gray-50 dark:hover:bg-dark-300 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <MessageSquare className="w-4 h-4 inline mr-2 text-primary-500" />
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-800 p-3 bg-white dark:bg-dark-200">
          <form
            onSubmit={handleSubmit}
            className="max-w-4xl mx-auto flex items-end gap-2"
          >
            <textarea
              rows={1}
              value={input}
              onKeyDown={handleInputKeyDown}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập câu hỏi cho AI..."
              className="flex-1 resize-none px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-dark-300 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={
                !input.trim() ||
                isSending ||
                isLoadingHistory ||
                isSwitchingThread
              }
              className="h-11 w-11 flex items-center justify-center rounded-full bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
