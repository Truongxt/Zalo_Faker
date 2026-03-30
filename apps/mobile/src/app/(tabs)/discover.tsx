import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { aiService } from "@/services";

type LocalAIMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<LocalAIMessage[]>([
    {
      id: "welcome-ai",
      role: "assistant",
      text: "Xin chao, minh la AI Assistant. Ban co the hoi bat ky dieu gi lien quan den du lieu cua ban.",
      createdAt: new Date().toISOString(),
    },
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
      const result = await aiService.ask(question);

      appendMessage({
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: result.answer || "Xin loi, minh chua the tra loi luc nay.",
        createdAt: new Date().toISOString(),
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Khong the ket noi AI. Vui long thu lai.";

      appendMessage({
        id: `ai-error-${Date.now()}`,
        role: "assistant",
        text: `Loi: ${errorMessage}`,
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
        <Text className="text-xl font-bold text-slate-900">AI Assistant</Text>
        <Text className="mt-1 text-sm text-slate-500">
          Tra loi dua tren du lieu lien quan cua ban trong he thong
        </Text>
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
            placeholder="Hoi AI ve thong tin cua ban..."
            className="max-h-28 flex-1 py-2 text-base text-slate-900"
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
      </View>
    </KeyboardAvoidingView>
  );
}
