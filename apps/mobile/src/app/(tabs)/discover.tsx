import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { aiService } from "@/services";

type LocalAIMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type ConversationTab = {
  id: string;
  title: string;
  lastAskedAt: string;
};

const toThreadTitle = (question?: string) => {
  const normalized = String(question || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return "Hội thoại mới";
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
};

const buildConversationId = () =>
  `ai-mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildWelcomeMessage = (): LocalAIMessage => ({
  id: `welcome-ai-${Date.now()}`,
  role: "assistant",
  text: "Xin chào, mình là AI Assistant. Bạn có thể hỏi bất kỳ điều gì liên quan đến dữ liệu của bạn.",
  createdAt: new Date().toISOString(),
});

const buildMessagesFromHistory = (
  items: Array<{
    chatId: string;
    question: string;
    answer: string;
    askedAt: string;
  }>,
): LocalAIMessage[] => {
  const sorted = items
    .slice()
    .sort(
      (a, b) =>
        new Date(a.askedAt || 0).getTime() - new Date(b.askedAt || 0).getTime(),
    );

  const result: LocalAIMessage[] = [buildWelcomeMessage()];

  sorted.forEach((item) => {
    result.push({
      id: `history-user-${item.chatId}`,
      role: "user",
      text: item.question,
      createdAt: item.askedAt,
    });

    result.push({
      id: `history-ai-${item.chatId}`,
      role: "assistant",
      text: item.answer,
      createdAt: item.askedAt,
    });
  });

  return result;
};

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string>(() =>
    buildConversationId(),
  );
  const [showHistoryThreads, setShowHistoryThreads] = useState(false);
  const [conversationTabs, setConversationTabs] = useState<ConversationTab[]>(
    [],
  );
  const [messages, setMessages] = useState<LocalAIMessage[]>(() => [
    buildWelcomeMessage(),
  ]);
  const listRef = useRef<FlatList<LocalAIMessage>>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending,
    [input, isSending],
  );

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const appendMessage = (message: LocalAIMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleCreateNewConversation = () => {
    const newId = buildConversationId();
    const now = new Date().toISOString();
    setActiveConversationId(newId);
    setConversationTabs((prev) => [
      {
        id: newId,
        title: "Hội thoại mới",
        lastAskedAt: now,
      },
      ...prev,
    ]);
    setInput("");
    setMessages([buildWelcomeMessage()]);
    setShowHistoryThreads(false);
    scrollToBottom();
  };

  const handleDeleteThread = (conversationId: string, title: string) => {
    Alert.alert("Xoa hoi thoai", `Ban co chac muon xoa thread \"${title}\"?`, [
      {
        text: "Huy",
        style: "cancel",
      },
      {
        text: "Xoa",
        style: "destructive",
        onPress: async () => {
          try {
            await aiService.deleteConversationHistory(conversationId);

            setConversationTabs((prev) => {
              const remaining = prev.filter((tab) => tab.id !== conversationId);

              if (!remaining.length) {
                const fallbackId = buildConversationId();
                setActiveConversationId(fallbackId);
                setMessages([buildWelcomeMessage()]);
                setShowHistoryThreads(false);
                return [
                  {
                    id: fallbackId,
                    title: "Hội thoại mới",
                    lastAskedAt: new Date().toISOString(),
                  },
                ];
              }

              const nextActive =
                activeConversationId === conversationId
                  ? remaining[0].id
                  : activeConversationId;

              if (
                nextActive !== activeConversationId ||
                activeConversationId === conversationId
              ) {
                loadConversationMessages(nextActive);
              }

              return remaining;
            });
          } catch (error) {
            Alert.alert("Loi", "Khong the xoa thread. Vui long thu lai.");
          }
        },
      },
    ]);
  };

  const loadConversationMessages = async (conversationId: string) => {
    setIsLoadingHistory(true);

    try {
      const history = await aiService.getHistory(50, conversationId);
      setMessages(buildMessagesFromHistory(history));
      setActiveConversationId(conversationId);
      scrollToBottom();
    } catch (error) {
      setMessages([buildWelcomeMessage()]);
      setActiveConversationId(conversationId);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);

      try {
        const history = await aiService.getHistory(100);

        if (!history.length) {
          const fallbackId = buildConversationId();
          setActiveConversationId(fallbackId);
          setConversationTabs([
            {
              id: fallbackId,
              title: "Hội thoại mới",
              lastAskedAt: new Date().toISOString(),
            },
          ]);
          return;
        }

        const groupedByConversation = new Map<string, typeof history>();

        history.forEach((item) => {
          if (!item.conversationId) return;
          const key = item.conversationId;
          const bucket = groupedByConversation.get(key) || [];
          bucket.push(item);
          groupedByConversation.set(key, bucket);
        });

        const tabs: ConversationTab[] = Array.from(
          groupedByConversation.entries(),
        )
          .map(([conversationId, items], index) => {
            const lastAskedAt = items.reduce((latest, item) => {
              if (!latest) return item.askedAt;
              return new Date(item.askedAt).getTime() >
                new Date(latest).getTime()
                ? item.askedAt
                : latest;
            }, "");

            const firstQuestion = items
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.askedAt || 0).getTime() -
                  new Date(b.askedAt || 0).getTime(),
              )[0]?.question;

            return {
              id: conversationId,
              title: toThreadTitle(firstQuestion),
              lastAskedAt,
            };
          })
          .sort(
            (a, b) =>
              new Date(b.lastAskedAt || 0).getTime() -
              new Date(a.lastAskedAt || 0).getTime(),
          );

        const firstTab = tabs[0];

        if (!firstTab) {
          const fallbackId = buildConversationId();
          setActiveConversationId(fallbackId);
          setConversationTabs([
            {
              id: fallbackId,
              title: "Hội thoại mới",
              lastAskedAt: new Date().toISOString(),
            },
          ]);
          return;
        }

        setConversationTabs(tabs);
        setActiveConversationId(firstTab.id);

        const firstHistory = groupedByConversation.get(firstTab.id) || [];
        const firstMessages = buildMessagesFromHistory(firstHistory);
        setMessages(firstMessages);

        scrollToBottom();
      } catch (error) {
        const fallbackId = buildConversationId();
        setActiveConversationId(fallbackId);
        setConversationTabs([
          {
            id: fallbackId,
            title: "Hội thoại mới",
            lastAskedAt: new Date().toISOString(),
          },
        ]);
        setMessages([buildWelcomeMessage()]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, []);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isSending) return;

    setInput("");
    appendMessage({
      id: `user-${Date.now()}`,
      role: "user",
      text: question,
      createdAt: new Date().toISOString(),
    });

    setIsSending(true);
    scrollToBottom();

    try {
      const result = await aiService.ask(question, activeConversationId);

      setConversationTabs((prev) => {
        const now = new Date().toISOString();
        const existing = prev.find((tab) => tab.id === activeConversationId);
        const nextTitle =
          existing?.title === "Hoi thoai moi"
            ? toThreadTitle(question)
            : existing?.title;

        if (existing) {
          const updated = prev.map((tab) =>
            tab.id === activeConversationId
              ? { ...tab, title: nextTitle || tab.title, lastAskedAt: now }
              : tab,
          );

          return updated.sort(
            (a, b) =>
              new Date(b.lastAskedAt || 0).getTime() -
              new Date(a.lastAskedAt || 0).getTime(),
          );
        }

        return [
          {
            id: activeConversationId,
            title: toThreadTitle(question),
            lastAskedAt: now,
          },
          ...prev,
        ];
      });

      appendMessage({
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: result.answer || "Xin lỗi, mình chưa thể trả lời lúc này.",
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể kết nối AI. Vui lòng thử lại.";

      appendMessage({
        id: `ai-error-${Date.now()}`,
        role: "assistant",
        text: `Lỗi: ${errorMessage}`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        className="border-b border-slate-200 bg-white px-4 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-slate-900">AI Assistant</Text>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => setShowHistoryThreads((prev) => !prev)}
              disabled={isSending}
              className={`mr-2 h-9 w-9 items-center justify-center rounded-full border ${
                showHistoryThreads
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={showHistoryThreads ? "#b45309" : "#475569"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreateNewConversation}
              disabled={isSending}
              className={`h-9 w-9 items-center justify-center rounded-full border ${
                isSending
                  ? "border-slate-200 bg-slate-100"
                  : "border-blue-200 bg-blue-50"
              }`}
            >
              <Text
                className={`${isSending ? "text-slate-300" : "text-blue-600"}`}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text className="mt-1 text-sm text-slate-500">
          Trả lời dựa trên dữ liệu liên quan của bạn trong hệ thống
        </Text>
        {showHistoryThreads ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {conversationTabs.map((tab) => {
              const isActive = tab.id === activeConversationId;

              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => loadConversationMessages(tab.id)}
                  onLongPress={() => handleDeleteThread(tab.id, tab.title)}
                  delayLongPress={250}
                  className={`mr-2 rounded-full border px-3 py-1.5 ${
                    isActive
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                  disabled={isSending || isLoadingHistory}
                >
                  <Text
                    className={`text-xs ${
                      isActive
                        ? "font-semibold text-blue-700"
                        : "text-slate-600"
                    }`}
                  >
                    {tab.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 14 }}
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          return (
            <View className={`mb-3 ${isUser ? "items-end" : "items-start"}`}>
              <View
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  isUser ? "bg-blue-500" : "border border-slate-200 bg-white"
                }`}
              >
                <Text className={`${isUser ? "text-white" : "text-slate-800"}`}>
                  {item.text}
                </Text>
              </View>
            </View>
          );
        }}
        onContentSizeChange={scrollToBottom}
      />

      <View className="border-t border-slate-200 bg-white px-3 pt-2 pb-3">
        <View className="flex-row items-end rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            multiline
            placeholder="Hỏi AI về thông tin của bạn..."
            className="max-h-28 flex-1 py-1 text-base text-slate-900"
            editable={!isSending}
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            className={`ml-2 h-10 w-10 items-center justify-center rounded-full ${
              canSend ? "bg-blue-500" : "bg-slate-300"
            }`}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-lg text-white">↑</Text>
            )}
          </TouchableOpacity>
        </View>
        {isLoadingHistory ? (
          <View className="mt-2 flex-row items-center">
            <ActivityIndicator size="small" color="#64748b" />
            <Text className="ml-2 text-xs text-slate-500">
              Đang tải lịch sử AI...
            </Text>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
