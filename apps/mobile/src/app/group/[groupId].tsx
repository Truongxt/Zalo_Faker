import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
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
import {
  getGroupById,
  pinGroupMessage,
  unpinGroupMessage,
} from "@/services/groupService";
import { STICKER_URLS } from "@/constants/stickers";
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
  const { messages, conversations, updateConversation } = useChatStore();
  const convMessages: Message[] = (messages as any)[convId] || [];
  const hasCachedMessages = convMessages.length > 0;
  const conversation = conversations.find((item) => item.id === convId);

  const [group, setGroup] = useState<any>(null);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [localPinnedMessage, setLocalPinnedMessage] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const myGroupRole = String(
    conversation?.participants?.find(
      (participant) => String(participant.userId) === String(user?.id),
    )?.role || "member",
  ).toLowerCase();
  const pinScope = String(
    conversation?.groupSettings?.permissions?.pinMessage || "admin_deputy",
  ).toLowerCase();
  const canPinInGroup = (() => {
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

    const currentRank = roleRank[myGroupRole] || 0;
    const requiredRank = scopeRank[pinScope] || 2;
    return currentRank >= requiredRank;
  })();

  const pinnedMessage =
    conversation?.groupSettings?.pinnedMessage || localPinnedMessage || null;

  const getPinnedMessagePreview = useCallback((message: any) => {
    if (!message) return "Tin nhắn đã ghim";

    if (message.metadata?.isAnnouncement) {
      const announceText = String(message.content?.text || "").trim();
      return announceText ? `[Thông báo] ${announceText}` : "[Thông báo]";
    }

    const content = message.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    if (content && typeof content === "object") {
      const text = String(
        content.text || content.message || content.content || "",
      ).trim();
      if (text) return text;

      if (typeof content.fileName === "string" && content.fileName.trim()) {
        return `[File] ${content.fileName.trim()}`;
      }
    }

    if (message.type === "image") return "[Hình ảnh]";
    if (message.type === "video") return "[Video]";
    if (message.type === "voice") return "[Tin nhắn thoại]";
    if (message.type === "sticker") return "[Sticker]";
    if (message.type === "file") return "[Tập tin]";
    return "Tin nhắn đã ghim";
  }, []);

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

  useEffect(() => {
    setShowStickerPicker(false);
  }, [convId]);

  useEffect(() => {
    if (conversation?.groupSettings?.pinnedMessage !== undefined) {
      setLocalPinnedMessage(conversation.groupSettings.pinnedMessage || null);
      return;
    }

    const fromGroup = (group as any)?.groupSettings?.pinnedMessage;
    if (fromGroup !== undefined) {
      setLocalPinnedMessage(fromGroup || null);
    }
  }, [conversation?.groupSettings?.pinnedMessage, group]);

  const handleUpdatePinnedMessage = useCallback(
    (nextPinnedMessage: any | null) => {
      setLocalPinnedMessage(nextPinnedMessage);

      if (!conversation) return;

      const fallbackSettings = {
        invite: {
          code: conversation.groupSettings?.invite?.code || "",
          approvalRequired:
            conversation.groupSettings?.invite?.approvalRequired ?? true,
        },
        permissions: {
          sendMedia:
            conversation.groupSettings?.permissions?.sendMedia || "all",
          pinMessage:
            conversation.groupSettings?.permissions?.pinMessage ||
            "admin_deputy",
          sendAnnouncement:
            conversation.groupSettings?.permissions?.sendAnnouncement ||
            "admin_deputy",
        },
        pinnedMessage: null,
      };

      updateConversation(convId, {
        groupSettings: {
          ...(conversation.groupSettings || fallbackSettings),
          pinnedMessage: nextPinnedMessage,
        },
      });
    },
    [convId, conversation, updateConversation],
  );

  useEffect(() => {
    if (!convId || !user) return;

    const socket = socketService.getSocket() || socketService.connect();
    if (!socket) return;

    const onPinnedMessage = ({
      conversationId: incomingConversationId,
      pinnedMessage: nextPinnedMessage,
    }: {
      conversationId: string;
      pinnedMessage: any | null;
    }) => {
      if (String(incomingConversationId) !== String(convId)) return;
      handleUpdatePinnedMessage(nextPinnedMessage || null);
    };

    socket.on("chat:pinned_message", onPinnedMessage);

    return () => {
      socket.off("chat:pinned_message", onPinnedMessage);
    };
  }, [convId, handleUpdatePinnedMessage, user]);

  const handlePinMessage = useCallback(
    async (message: Message) => {
      if (!canPinInGroup) {
        GrayToast("Bạn không có quyền ghim tin nhắn trong nhóm này");
        return;
      }

      if (message.isDeleted) {
        GrayToast("Không thể ghim tin nhắn đã thu hồi");
        return;
      }

      const targetGroupId = String(groupId || convId);
      if (!targetGroupId) return;

      try {
        const result = await pinGroupMessage(targetGroupId, message.id);
        const nextPinned =
          (result as any)?.pinnedMessage ||
          (result as any)?.group?.groupSettings?.pinnedMessage ||
          null;
        handleUpdatePinnedMessage(nextPinned);
        socketService.emit("chat:sync_pinned_message", { conversationId: convId });
        GrayToast("Đã ghim tin nhắn");
      } catch (error: any) {
        GrayToast(error?.message || "Không thể ghim tin nhắn");
      }
    },
    [canPinInGroup, convId, groupId, handleUpdatePinnedMessage],
  );

  const handleUnpinMessage = useCallback(async () => {
    if (!canPinInGroup) {
      GrayToast("Bạn không có quyền bỏ ghim tin nhắn trong nhóm này");
      return;
    }

    const targetGroupId = String(groupId || convId);
    if (!targetGroupId) return;

    try {
      await unpinGroupMessage(targetGroupId);
      handleUpdatePinnedMessage(null);
      socketService.emit("chat:sync_pinned_message", { conversationId: convId });
      GrayToast("Đã bỏ ghim tin nhắn");
    } catch (error: any) {
      GrayToast(error?.message || "Không thể bỏ ghim tin nhắn");
    }
  }, [canPinInGroup, convId, groupId, handleUpdatePinnedMessage]);

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

  const handleToggleStickerPicker = useCallback(() => {
    setShowStickerPicker((prev) => !prev);
  }, []);

  const handleSendSticker = useCallback(
    async (stickerUrl: string) => {
      if (!convId || isSending) return;

      setShowStickerPicker(false);
      setIsSending(true);
      try {
        await chatService.sendMessage(convId, {
          type: "sticker",
          content: stickerUrl,
        });
      } catch {
        GrayToast("Không thể gửi sticker");
      } finally {
        setIsSending(false);
      }
    },
    [convId, isSending],
  );

  const handleLongPress = (msg: Message) => {
    const isMe = msg.senderId === user?.id;
    const isPinnedMessage = Boolean(
      pinnedMessage && String(pinnedMessage.messageId) === String(msg.id),
    );
    setSelectedMsg(msg);

    const opts: any[] = [
      { text: "Thả cảm xúc", onPress: () => setShowReactions(true) },
    ];

    if (!msg.isDeleted && canPinInGroup) {
      opts.push({
        text: isPinnedMessage ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn",
        onPress: () => {
          if (isPinnedMessage) {
            void handleUnpinMessage();
            return;
          }
          void handlePinMessage(msg);
        },
      });
    }

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
            ) : item.type === "sticker" ? (
              <Image
                source={{ uri: String(item.content || "") }}
                style={{ width: 100, height: 100 }}
                resizeMode="contain"
              />
            ) : (
              <Text
                style={{ color: isMe ? "#fff" : "#111827", lineHeight: 20 }}
              >
                {typeof item.content === "string"
                  ? item.content
                  : String((item.content as any)?.text || "")}
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
      {pinnedMessage && (
        <View
          style={{
            backgroundColor: "#FFFBEB",
            borderBottomWidth: 1,
            borderBottomColor: "#FDE68A",
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Ionicons name="pin" size={14} color="#B45309" />
            <View style={{ marginLeft: 6, flex: 1 }}>
              <Text
                style={{
                  color: "#92400E",
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                Tin nhắn đã ghim
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: "#92400E", fontSize: 12 }}
              >
                {getPinnedMessagePreview(pinnedMessage)}
              </Text>
            </View>
          </View>

          {canPinInGroup && (
            <TouchableOpacity
              onPress={() => void handleUnpinMessage()}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: "#FEF3C7",
                borderWidth: 1,
                borderColor: "#F59E0B",
              }}
            >
              <Text
                style={{ color: "#92400E", fontSize: 11, fontWeight: "700" }}
              >
                Bỏ ghim
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
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
          paddingBottom: Math.max(insets.bottom, 6),
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
            onPress={handleToggleStickerPicker}
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

        {showStickerPicker && (
          <View
            style={{
              marginTop: 8,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              backgroundColor: "#F8FAFC",
              paddingVertical: 8,
              paddingHorizontal: 6,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 2 }}
            >
              {STICKER_URLS.map((url, index) => (
                <TouchableOpacity
                  key={`${url}-${index}`}
                  onPress={() => void handleSendSticker(url)}
                  disabled={isSending}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    marginRight: index === STICKER_URLS.length - 1 ? 0 : 8,
                    opacity: isSending ? 0.7 : 1,
                  }}
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: 50, height: 50 }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
