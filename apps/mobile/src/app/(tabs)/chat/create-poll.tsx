import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GrayToast } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { chatService } from "@/services/chat";
import { pinGroupMessage } from "@/services/groupService";

const createEmptyOptions = () => ["", ""];

const formatDeadline = (value: Date | null) => {
  if (!value) return "Không có thời hạn";
  return value.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function CreatePollScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { user } = useAuthStore();
  const conversation = useChatStore((state) =>
    state.conversations.find((item) => String(item.id) === String(conversationId || "")),
  );

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(createEmptyOptions());
  const [pinToConversation, setPinToConversation] = useState(false);
  const [anonymousVoters, setAnonymousVoters] = useState(false);
  const [hideResultsUntilVote, setHideResultsUntilVote] = useState(false);
  const [allowMultipleChoices, setAllowMultipleChoices] = useState(true);
  const [allowAddOptions, setAllowAddOptions] = useState(true);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const role = String(
    conversation?.participants?.find(
      (participant) => String(participant.userId) === String(user?.id),
    )?.role || "member",
  ).toLowerCase();
  const pinScope = String(
    conversation?.groupSettings?.permissions?.pinMessage || "admin_deputy",
  ).toLowerCase();
  const canPinInGroup = useMemo(() => {
    const roleRank: Record<string, number> = {
      member: 1,
      deputy: 2,
      admin: 3,
    };
    const scopeRank: Record<string, number> = {
      all: 1,
      admin_deputy: 2,
      admin: 3,
    };
    return (roleRank[role] || 0) >= (scopeRank[pinScope] || Number.MAX_SAFE_INTEGER);
  }, [pinScope, role]);

  const normalizedOptions = options.map((option) => option.trim()).filter(Boolean);
  const canSubmit =
    question.trim().length > 0 &&
    normalizedOptions.length >= 2 &&
    !isSubmitting &&
    conversation?.type === "group";

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, optionIndex) => (optionIndex === index ? value : option)));
  };

  const removeOption = (index: number) => {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, optionIndex) => optionIndex !== index)));
  };

  const handleDeadlineChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDeadlinePicker(false);
    if (selectedDate) {
      setDeadline(selectedDate);
    }
  };

  const handleCreatePoll = async () => {
    if (!conversationId || !conversation || conversation.type !== "group") {
      GrayToast("Chỉ tạo được bình chọn trong nhóm");
      return;
    }

    const trimmedQuestion = question.trim();
    const trimmedOptions = Array.from(
      new Set(options.map((option) => option.trim()).filter(Boolean)),
    );

    if (!trimmedQuestion) {
      Alert.alert("Thiếu câu hỏi", "Vui lòng nhập câu hỏi bình chọn.");
      return;
    }

    if (trimmedOptions.length < 2) {
      Alert.alert("Thiếu phương án", "Bình chọn cần ít nhất 2 phương án");
      return;
    }

    if (deadline && deadline.getTime() <= Date.now()) {
      Alert.alert("Hạn không hợp lệ", "Thời hạn phải sau thời gian hiện tại.");
      return;
    }

    setIsSubmitting(true);
    try {
      const savedMessage = await chatService.sendMessage(String(conversationId), {
        type: "poll",
        content: {
          question: trimmedQuestion,
          options: trimmedOptions.map((text) => ({ text })),
          settings: {
            anonymousVoters,
            hideResultsUntilVote,
            allowMultipleChoices,
            allowAddOptions,
            expiresAt: deadline ? deadline.toISOString() : null,
          },
        },
      });

      if (pinToConversation && canPinInGroup && savedMessage?.id) {
        try {
          await pinGroupMessage(String(conversationId), String(savedMessage.id));
        } catch (error) {
          console.error("Không thể ghim bình chọn:", error);
          GrayToast("Đã tạo bình chọn nhưng không thể ghim lên đầu cuộc trò chuyện.");
        }
      }

      GrayToast("Đã tạo bình chọn");
      router.back();
    } catch (error: any) {
      Alert.alert("Không thể tạo bình chọn", error?.message || "Vui lòng thử lại");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!conversation || conversation.type !== "group") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 16, color: "#475569", textAlign: "center" }}>
            Không tìm thấy nhóm để tạo bình chọn
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 16,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: "#2563EB",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={["bottom"]}>
      <View
        style={{
          backgroundColor: "#fff",
          paddingTop: Math.max(insets.top, 10),
          paddingHorizontal: 14,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
            Tạo bình chọn mới
          </Text>
          <Text style={{ marginTop: 2, color: "#64748B", fontSize: 13 }}>
            {conversation.name || "Nhom chat"}
          </Text>
        </View>
        <TouchableOpacity disabled={!canSubmit} onPress={handleCreatePoll}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Text
              style={{
                color: canSubmit ? "#2563EB" : "#BFDBFE",
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              TẠO
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ backgroundColor: "#fff", marginTop: 10, paddingHorizontal: 18, paddingVertical: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 16, color: "#111827" }}>Ghim lên đầu trò chuyện</Text>
            <Switch value={pinToConversation} onValueChange={setPinToConversation} disabled={!canPinInGroup} />
          </View>
          {!canPinInGroup && (
            <Text style={{ marginTop: 8, color: "#94A3B8", fontSize: 12 }}>
              Bạn không có quyền ghim bình chọn này.
            </Text>
          )}
        </View>

        <View style={{ backgroundColor: "#fff", marginTop: 10, paddingHorizontal: 18, paddingVertical: 18 }}>
          <Text style={{ fontSize: 15, color: "#2563EB", fontWeight: "700", marginBottom: 14 }}>
            Đặt câu hỏi bình chọn
          </Text>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Nhập câu hỏi"
            placeholderTextColor="#94A3B8"
            multiline
            style={{
              minHeight: 80,
              fontSize: 18,
              color: "#111827",
              textAlignVertical: "top",
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
              paddingBottom: 12,
            }}
          />

          <View style={{ marginTop: 18, gap: 14 }}>
            {options.map((option, index) => (
              <View
                key={`poll-option-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: "#E5E7EB",
                  paddingBottom: 12,
                }}
              >
                <TextInput
                  value={option}
                  onChangeText={(value) => updateOption(index, value)}
                  placeholder={`Phương án ${index + 1}`}
                  placeholderTextColor="#94A3B8"
                  style={{ flex: 1, fontSize: 16, color: "#111827" }}
                />
                <TouchableOpacity
                  onPress={() => removeOption(index)}
                  disabled={options.length <= 2}
                  style={{ paddingLeft: 10, opacity: options.length <= 2 ? 0.35 : 1 }}
                >
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => setOptions((prev) => [...prev, ""])}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: "#2563EB", fontSize: 16, fontWeight: "700" }}>
              Thêm phương án
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: "#fff", marginTop: 10, paddingHorizontal: 18, paddingVertical: 18 }}>
          <Text style={{ color: "#2563EB", fontSize: 15, fontWeight: "700", marginBottom: 16 }}>
            Tùy chọn
          </Text>

          <TouchableOpacity
            onPress={() => setShowDeadlinePicker(true)}
            style={{
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
            }}
          >
            <Text style={{ fontSize: 16, color: "#111827" }}>Đặt thời hạn</Text>
            <Text style={{ marginTop: 6, color: "#94A3B8", fontSize: 14 }}>
              {formatDeadline(deadline)}
            </Text>
          </TouchableOpacity>

          {deadline && (
            <TouchableOpacity onPress={() => setDeadline(null)} style={{ paddingTop: 10 }}>
              <Text style={{ color: "#2563EB", fontSize: 14, fontWeight: "700" }}>
                Xóa thời hạn
              </Text>
            </TouchableOpacity>
          )}

          {[
            {
              label: "Ẩn người bình chọn",
              value: anonymousVoters,
              onChange: setAnonymousVoters,
            },
            {
              label: "Ẩn kết quả khi chưa bình chọn",
              value: hideResultsUntilVote,
              onChange: setHideResultsUntilVote,
            },
            {
              label: "Chọn nhiều phương án",
              value: allowMultipleChoices,
              onChange: setAllowMultipleChoices,
            },
            {
              label: "Có thể thêm phương án",
              value: allowAddOptions,
              onChange: setAllowAddOptions,
            },
          ].map((item) => (
            <View
              key={item.label}
              style={{
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#E5E7EB",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ flex: 1, paddingRight: 10, fontSize: 16, color: "#111827" }}>
                {item.label}
              </Text>
              <Switch value={item.value} onValueChange={item.onChange} />
            </View>
          ))}
        </View>
      </ScrollView>

      {showDeadlinePicker && (
        <DateTimePicker
          value={deadline || new Date(Date.now() + 60 * 60 * 1000)}
          mode="datetime"
          minimumDate={new Date()}
          onChange={handleDeadlineChange}
        />
      )}
    </SafeAreaView>
  );
}
