import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
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
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { useChatStore } from "@/stores/chatStore";
import { useAuthStore } from "@/stores/authStore";
import { chatService } from "@/services/chat";
import { socketService } from "@/lib/socket";
import { Avatar } from "@/components/ui/Avatar";
import { GrayToast } from "@/components/ui";
import type { Message } from "@/types";
import { API_URL } from "@/constants/config";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

/** Upload a single file (image / document / voice) to server */
async function uploadFile(
  uri: string,
  name: string,
  mimeType: string,
  accessToken: string | null,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", { uri, name, type: mimeType } as any);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });

  if (!res.ok) throw new Error("Upload thất bại");
  const data = await res.json();
  return data.url as string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

type MessageItemProps = {
  msg: Message;
  isMe: boolean;
  onLongPress: (msg: Message) => void;
};

function MessageItem({ msg, isMe, onLongPress }: MessageItemProps) {
  const bg = isMe ? "#0068FF" : "#F3F4F6";
  const textColor = isMe ? "#fff" : "#111827";

  const renderContent = () => {
    if (msg.isDeleted) {
      return (
        <Text style={{ color: isMe ? "#cce4ff" : "#9CA3AF", fontStyle: "italic" }}>
          Tin nhắn đã bị thu hồi
        </Text>
      );
    }

    switch (msg.type) {
      case "image":
        return (
          <Image
            source={{ uri: (msg as any).attachments?.[0]?.url || msg.content }}
            style={{ width: 200, height: 150, borderRadius: 12 }}
            resizeMode="cover"
          />
        );
      case "voice":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="mic" size={18} color={textColor} />
            <Text style={{ color: textColor }}>
              Tin nhắn thoại {(msg as any).attachments?.[0]?.duration ? `(${(msg as any).attachments[0].duration}s)` : ""}
            </Text>
          </View>
        );
      case "file":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="document-outline" size={18} color={textColor} />
            <Text style={{ color: textColor, flex: 1 }} numberOfLines={1}>
              {(msg as any).attachments?.[0]?.name || "File đính kèm"}
            </Text>
          </View>
        );
      case "sticker":
        return (
          <Image
            source={{ uri: msg.content }}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
        );
      default:
        return <Text style={{ color: textColor, lineHeight: 20 }}>{msg.content}</Text>;
    }
  };

  const topReactions = (msg.reactions || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(msg)}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        justifyContent: isMe ? "flex-end" : "flex-start",
        marginHorizontal: 12,
        marginVertical: 3,
      }}
    >
      {!isMe && (
        <Avatar
          name={msg.senderName || "?"}
          uri={(msg as any).senderAvatar}
          size={32}
        />
      )}

      <View style={{ maxWidth: "72%", marginLeft: isMe ? 0 : 8 }}>
        {!isMe && (
          <Text style={{ fontSize: 11, color: "#6B7280", marginBottom: 2, marginLeft: 4 }}>
            {msg.senderName}
          </Text>
        )}

        <View
          style={{
            backgroundColor: bg,
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          {renderContent()}
        </View>

        <View style={{ flexDirection: "row", justifyContent: isMe ? "flex-end" : "flex-start", gap: 6, marginTop: 2 }}>
          <Text style={{ fontSize: 10, color: "#9CA3AF" }}>{formatTime(msg.createdAt)}</Text>
          {Object.keys(topReactions).length > 0 && (
            <View style={{ flexDirection: "row" }}>
              {Object.entries(topReactions).map(([emoji, count]) => (
                <Text key={emoji} style={{ fontSize: 11 }}>
                  {emoji}{count > 1 ? count : ""}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatRoomScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuthStore();

  const { messages, conversations, addMessage, updateConversation } = useChatStore();
  const convId = conversationId || "";
  const convMessages: Message[] = (messages as any)[convId] || [];
  const conversation = conversations.find((c) => c.id === convId);

  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Determine conversation name
  const otherParticipant = conversation?.participants?.find(
    (p) => p.userId !== user?.id,
  );
  const convName =
    conversation?.type === "group"
      ? conversation.name || "Nhóm chat"
      : otherParticipant?.fullName || "Người dùng";
  const convAvatar =
    conversation?.type === "group"
      ? conversation.avatarUrl
      : otherParticipant?.avatarUrl;

  // Load messages on mount
  useEffect(() => {
    if (!convId) return;
    const load = async () => {
      setIsLoading(true);
      await chatService.loadMessages(convId);
      setIsLoading(false);
    };
    load();
  }, [convId]);

  // Join socket room + listeners
  useEffect(() => {
    if (!convId || !user) return;

    const socket = socketService.connect();
    if (!socket) return;

    socketService.joinRoom(convId);

    const onTyping = ({ userId, conversationId: cId }: any) => {
      if (cId !== convId || userId === user.id) return;
      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUsers([]), 3000);
    };

    const onStopTyping = ({ userId }: any) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    socket.on("chat:typing", onTyping);
    socket.on("chat:stop_typing", onStopTyping);

    return () => {
      socketService.leaveRoom(convId);
      socket.off("chat:typing", onTyping);
      socket.off("chat:stop_typing", onStopTyping);
    };
  }, [convId, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (convMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [convMessages.length]);

  const handleTextChange = (val: string) => {
    setText(val);
    if (convId && user) {
      socketService.emit("chat:typing", { conversationId: convId });
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText("");
    setIsSending(true);
    if (convId && user) {
      socketService.emit("chat:stop_typing", { conversationId: convId });
    }
    try {
      await chatService.sendMessage(convId, { type: "text", content: trimmed });
    } catch {
      GrayToast("Không thể gửi tin nhắn");
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Hãy cấp quyền truy cập ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const name = asset.fileName || `media-${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
    const mimeType = asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");

    setIsSending(true);
    try {
      const url = await uploadFile(asset.uri, name, mimeType, accessToken);
      await chatService.sendMessage(convId, {
        type: isVideo ? "video" : "image",
        content: url,
      });
    } catch {
      GrayToast("Không thể gửi ảnh/video");
    } finally {
      setIsSending(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setIsSending(true);
      const url = await uploadFile(asset.uri, asset.name, asset.mimeType || "application/octet-stream", accessToken);
      await chatService.sendMessage(convId, { type: "file", content: url });
    } catch {
      GrayToast("Không thể gửi file");
    } finally {
      setIsSending(false);
    }
  };

  const handleLongPress = (msg: Message) => {
    setSelectedMsg(msg);
    const isMe = msg.senderId === user?.id;

    const options: Array<{ text: string; onPress?: () => void; style?: "destructive" | "cancel" }> = [
      {
        text: "Thả cảm xúc",
        onPress: () => setShowReactions(true),
      },
    ];

    if (isMe && !msg.isDeleted) {
      options.push({
        text: "Thu hồi tin nhắn",
        style: "destructive",
        onPress: () => {
          Alert.alert("Thu hồi?", "Tin nhắn sẽ bị thu hồi với tất cả thành viên.", [
            { text: "Hủy", style: "cancel" },
            {
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
            },
          ]);
        },
      });
    }

    options.push({ text: "Hủy", style: "cancel" });
    Alert.alert("Tùy chọn", undefined, options);
  };

  const handleReact = async (emoji: string) => {
    setShowReactions(false);
    if (!selectedMsg) return;
    await chatService.addReaction(convId, selectedMsg.id, emoji);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageItem
      msg={item}
      isMe={item.senderId === user?.id}
      onLongPress={handleLongPress}
    />
  );

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
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Avatar name={convName} uri={convAvatar} size={38} />

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontWeight: "700", fontSize: 15, color: "#111827" }} numberOfLines={1}>
            {convName}
          </Text>
          {typingUsers.length > 0 && (
            <Text style={{ fontSize: 11, color: "#0068FF" }}>Đang nhập...</Text>
          )}
          {conversation?.type === "group" && (
            <Text style={{ fontSize: 11, color: "#6B7280" }}>
              {conversation.participants?.length || 0} thành viên
            </Text>
          )}
        </View>

        <TouchableOpacity style={{ padding: 6 }}>
          <Ionicons name="call-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 6 }}>
          <Ionicons name="videocam-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 6 }}>
          <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#0068FF" />
          <Text style={{ marginTop: 12, color: "#9CA3AF" }}>Đang tải tin nhắn...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={convMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 10, paddingBottom: 4 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>💬</Text>
              <Text style={{ color: "#9CA3AF" }}>Hãy bắt đầu cuộc trò chuyện!</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          {REACTIONS.map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => handleReact(emoji)} style={{ padding: 4 }}>
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowReactions(false)} style={{ padding: 4 }}>
            <Ionicons name="close-circle-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input area */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          backgroundColor: "#fff",
          paddingHorizontal: 8,
          paddingVertical: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
          gap: 6,
        }}
      >
        <TouchableOpacity onPress={handlePickImage} style={{ padding: 8 }}>
          <Ionicons name="image-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickFile} style={{ padding: 8 }}>
          <Ionicons name="attach-outline" size={24} color="#6B7280" />
        </TouchableOpacity>

        <TextInput
          value={text}
          onChangeText={handleTextChange}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#9CA3AF"
          multiline
          style={{
            flex: 1,
            backgroundColor: "#F3F4F6",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            fontSize: 15,
            color: "#111827",
            maxHeight: 120,
          }}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || isSending}
          style={{
            backgroundColor: text.trim() && !isSending ? "#0068FF" : "#D1D5DB",
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
