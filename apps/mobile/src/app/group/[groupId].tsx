import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { GrayToast } from "@/components/ui";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";
import { socketService } from "@/lib/socket";
import { getGroupById } from "@/services/groupService";
import type { Message } from "@/types";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{
    groupId?: string;
    conversationId?: string;
  }>();
  const groupId = Array.isArray(params.groupId)
    ? params.groupId[0]
    : params.groupId;
  // Prefer conversationId param, fall back to groupId (both may point to same entity)
  const convId =
    (Array.isArray(params.conversationId)
      ? params.conversationId[0]
      : params.conversationId) ||
    groupId ||
    "";

  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { messages } = useChatStore();
  const convMessages: Message[] = (messages as any)[convId] || [];
  const hasCachedMessages = convMessages.length > 0;

  const [group, setGroup] = useState<any>(null);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Load group info
  useEffect(() => {
    if (!groupId) return;
    getGroupById(String(groupId))
      .then((g) => setGroup(g))
      .catch(() => null);
  }, [groupId]);

  // Load messages
  useEffect(() => {
    if (!convId) return;

    let cancelled = false;

    const load = async () => {
      if (hasCachedMessages) {
        setIsLoading(false);
        await chatService.loadMessages(convId).catch(() => null);
        return;
      }

      setIsLoading(true);
      await chatService.loadMessages(convId).catch(() => null);
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [convId, hasCachedMessages]);

  // Socket
  useEffect(() => {
    if (!convId || !user) return;
    const socket = socketService.connect();
    if (!socket) return;
    socketService.joinRoom(convId);

    const onTyping = ({ userId, conversationId: cId }: any) => {
      if (cId !== convId || userId === user.id) return;
      setTypingUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId],
      );
      setTimeout(
        () => setTypingUsers((prev) => prev.filter((id) => id !== userId)),
        3000,
      );
    };
    socket.on("chat:typing", onTyping);

    return () => {
      socketService.leaveRoom(convId);
      socket.off("chat:typing", onTyping);
    };
  }, [convId, user?.id]);

  useEffect(() => {
    if (convMessages.length > 0)
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        100,
      );
  }, [convMessages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !convId) return;
    setText("");
    setIsSending(true);
    try {
      await chatService.sendMessage(convId, { type: "text", content: trimmed });
    } catch {
      GrayToast("Không thể gửi tin nhắn");
    } finally {
      setIsSending(false);
    }
  };

  const handleLongPress = (msg: Message) => {
    const isMe = msg.senderId === user?.id;
    setSelectedMsg(msg);

    const opts: any[] = [
      { text: "Thả cảm xúc", onPress: () => setShowReactions(true) },
    ];
    if (isMe && !msg.isDeleted) {
      opts.push({
        text: "Thu hồi",
        style: "destructive",
        onPress: () => {
          socketService.emit("chat:recall", {
            conversationId: convId,
            messageId: msg.id,
            senderId: user?.id,
          });
          chatService.deleteMessage(convId, msg.id);
        },
      });
    }
    opts.push({ text: "Hủy", style: "cancel" });
    Alert.alert("Tùy chọn", undefined, opts);
  };

  const handleReact = async (emoji: string) => {
    setShowReactions(false);
    if (!selectedMsg) return;
    await chatService.addReaction(convId, selectedMsg.id, emoji);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    const reactions = (item.reactions || []).reduce<Record<string, number>>(
      (acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
      },
      {},
    );

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          justifyContent: isMe ? "flex-end" : "flex-start",
          marginHorizontal: 12,
          marginVertical: 3,
        }}
      >
        {!isMe && <Avatar name={item.senderName || "?"} size={32} />}
        <View style={{ maxWidth: "72%", marginLeft: isMe ? 0 : 8 }}>
          {!isMe && (
            <Text
              style={{
                fontSize: 11,
                color: "#6B7280",
                marginBottom: 2,
                marginLeft: 4,
              }}
            >
              {item.senderName}
            </Text>
          )}
          <View
            style={{
              backgroundColor: isMe ? "#0068FF" : "#F3F4F6",
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            {item.isDeleted ? (
              <Text
                style={{
                  color: isMe ? "#cce4ff" : "#9CA3AF",
                  fontStyle: "italic",
                }}
              >
                Tin nhắn đã thu hồi
              </Text>
            ) : (
              <Text
                style={{ color: isMe ? "#fff" : "#111827", lineHeight: 20 }}
              >
                {item.content}
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: isMe ? "flex-end" : "flex-start",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <Text style={{ fontSize: 10, color: "#9CA3AF" }}>
              {formatTime(item.createdAt)}
            </Text>
            {Object.entries(reactions).map(([e, c]) => (
              <Text key={e} style={{ fontSize: 11 }}>
                {e}
                {c > 1 ? c : ""}
              </Text>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!convId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Không tìm thấy cuộc trò chuyện</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingTop: insets.top,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 4, marginRight: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Avatar name={group?.name || "Nhóm"} uri={group?.avatar} size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{ fontWeight: "700", fontSize: 15, color: "#111827" }}
            numberOfLines={1}
          >
            {group?.name || "Đang tải..."}
          </Text>
          {typingUsers.length > 0 ? (
            <Text style={{ fontSize: 11, color: "#0068FF" }}>Đang nhập...</Text>
          ) : (
            group?.members && (
              <Text style={{ fontSize: 11, color: "#6B7280" }}>
                {group.members.length} thành viên
              </Text>
            )
          )}
        </View>
        <TouchableOpacity style={{ padding: 6 }}>
          <Ionicons name="people-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 6 }}>
          <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#0068FF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={convMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 10 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Text style={{ fontSize: 36 }}>💬</Text>
              <Text style={{ color: "#9CA3AF", marginTop: 8 }}>
                Không có tin nhắn
              </Text>
            </View>
          }
        />
      )}

      {/* Reaction picker */}
      {showReactions && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#fff",
            borderRadius: 24,
            marginHorizontal: 16,
            marginBottom: 8,
            padding: 8,
            gap: 8,
            elevation: 4,
          }}
        >
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleReact(emoji)}
              style={{ padding: 4 }}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowReactions(false)}
            style={{ padding: 4 }}
          >
            <Ionicons name="close-circle-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 6) : 6,
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#ECEDEF",
            borderRadius: 26,
            minHeight: 50,
            paddingLeft: 6,
            paddingRight: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => GrayToast("Tính năng sticker đang phát triển")}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="happy-outline" size={28} color="#7B8088" />
          </TouchableOpacity>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Tin nhắn"
            placeholderTextColor="#8A8F98"
            multiline
            style={{
              flex: 1,
              marginLeft: 4,
              marginRight: 8,
              fontSize: 17,
              color: "#343A40",
              maxHeight: 110,
              paddingVertical: 8,
            }}
          />

          <TouchableOpacity
            onPress={() => GrayToast("Tính năng gửi file đang phát triển")}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={23} color="#7B8088" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={
              text.trim()
                ? handleSend
                : () => GrayToast("Tính năng ghi âm đang phát triển")
            }
            disabled={isSending}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#7B8088" />
            ) : (
              <Ionicons
                name={text.trim() ? "send" : "mic-outline"}
                size={24}
                color="#7B8088"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => GrayToast("Tính năng gửi ảnh đang phát triển")}
            style={{
              width: 36,
              height: 36,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="image-outline" size={24} color="#7B8088" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
